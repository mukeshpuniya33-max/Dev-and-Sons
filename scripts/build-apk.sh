#!/usr/bin/env bash
set -e

echo "=== Building Genuine Android APK for Staff Attendance & Payroll ==="

WORK_DIR="/tmp/android_apk_build"
rm -rf "$WORK_DIR"
mkdir -p "$WORK_DIR/src/com/plant/staffattendance"
mkdir -p "$WORK_DIR/gen"
mkdir -p "$WORK_DIR/bin"
mkdir -p "$WORK_DIR/res/drawable"
mkdir -p "$WORK_DIR/res/values"
mkdir -p "$WORK_DIR/assets"

# Copy icons and offline html into assets
cp public/pwa-192x192.png "$WORK_DIR/res/drawable/ic_launcher.png"
node -e "
  const fs = require('fs');
  const path = require('path');
  // Copy standalone html as index.html inside Android assets
  fs.copyFileSync('public/pwa-192x192.png', '$WORK_DIR/res/drawable/ic_launcher.png');
"

# Create res/values/strings.xml
cat << 'EOF' > "$WORK_DIR/res/values/strings.xml"
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">Staff Attendance</string>
</resources>
EOF

# Create AndroidManifest.xml
cat << 'EOF' > "$WORK_DIR/AndroidManifest.xml"
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.plant.staffattendance"
    android:versionCode="1"
    android:versionName="1.0">

    <uses-sdk android:minSdkVersion="21" android:targetSdkVersion="33" />
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

    <application
        android:label="@string/app_name"
        android:icon="@drawable/ic_launcher"
        android:allowBackup="true"
        android:usesCleartextTraffic="true"
        android:theme="@android:style/Theme.NoTitleBar.Fullscreen">
        <activity
            android:name=".MainActivity"
            android:configChanges="orientation|screenSize|keyboardHidden"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
EOF

# Create MainActivity.java with robust WebView and offline fallback
cat << 'EOF' > "$WORK_DIR/src/com/plant/staffattendance/MainActivity.java"
package com.plant.staffattendance;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.view.KeyEvent;
import android.graphics.Bitmap;

public class MainActivity extends Activity {
    private WebView webView;
    private final String ONLINE_URL = "https://ais-pre-ltn56efv54m42d5c5dvn4l-94327014952.asia-southeast1.run.app";
    private final String OFFLINE_URL = "file:///android_asset/index.html";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setBuiltInZoomControls(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                view.loadUrl(url);
                return true;
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                // If online fails (e.g. no internet or plant network), load embedded offline html
                if (request != null && request.isForMainFrame()) {
                    view.loadUrl(OFFLINE_URL);
                }
            }
        });

        webView.loadUrl(ONLINE_URL);
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && webView.canGoBack()) {
            webView.goBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }
}
EOF

# Bundle the standalone html into assets/index.html
node -e "
  const fs = require('fs');
  // Read index.html or generate standalone
  const html = fs.readFileSync('dist/index.html', 'utf8').catch ? '' : fs.readFileSync('dist/index.html', 'utf8');
" 2>/dev/null || true

# Pre-compile the standalone html into assets
npx tsx scripts/generate-offline-asset.ts "$WORK_DIR/assets/index.html"

cd "$WORK_DIR"

echo "1. Generating R.java via aapt..."
aapt package -m -J gen -M AndroidManifest.xml -S res -I /opt/android/android.jar

echo "2. Compiling Java sources via javac..."
javac -d bin -cp "/opt/android/android.jar:gen" src/com/plant/staffattendance/MainActivity.java gen/com/plant/staffattendance/R.java

echo "3. Converting to classes.dex via D8..."
java -cp /opt/android/r8.jar com.android.tools.r8.D8 --output . --lib /opt/android/android.jar bin/com/plant/staffattendance/*.class

echo "4. Packaging APK via aapt..."
aapt package -f -M AndroidManifest.xml -S res -A assets -I /opt/android/android.jar -F unsigned.apk
aapt add unsigned.apk classes.dex

echo "5. Aligning APK via zipalign..."
zipalign -p -f 4 unsigned.apk unaligned.apk

echo "6. Signing APK via apksigner..."
# Generate keystore if not exists
if [ ! -f /tmp/release.keystore ]; then
  keytool -genkeypair -alias plant -keypass plantpass -keystore /tmp/release.keystore -storepass plantpass -dname "CN=Plant, OU=Furnace, O=Steel, L=City, ST=State, C=IN" -keyalg RSA -keysize 2048 -validity 10000
fi

mkdir -p /public /tmp
apksigner sign --ks /tmp/release.keystore --ks-pass pass:plantpass --key-pass pass:plantpass --out /tmp/Staff_Attendance.apk unaligned.apk

# Verify signature
apksigner verify /tmp/Staff_Attendance.apk
echo "APK signature verified successfully!"

# Copy into public directory so users can download directly
mkdir -p /root/applet/public /workspace/public public 2>/dev/null || true
cp /tmp/Staff_Attendance.apk public/Staff_Attendance.apk
cp /tmp/Staff_Attendance.apk public/attendance.apk

echo "=== Successfully built public/Staff_Attendance.apk ($(du -h public/Staff_Attendance.apk | cut -f1)) ==="
