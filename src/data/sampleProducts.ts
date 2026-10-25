export interface SampleProduct {
  id: string;
  name: string;
  category: string;
  thumbnail: string;
  suggestedInstruction: string;
  description: string;
}

// Generate realistic product imagery with realistic background clutter to showcase cleanup & background removal
function createSampleImage(type: 'sneaker' | 'cosmetics' | 'watch' | 'mug' | 'headphone'): string {
  // We'll generate clean high-fidelity SVGs with realistic gradients and cluttered backgrounds as data URLs
  if (type === 'sneaker') {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">
        <defs>
          <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#4a3f35"/>
            <stop offset="50%" stop-color="#2d2822"/>
            <stop offset="100%" stop-color="#191614"/>
          </linearGradient>
          <pattern id="brickPattern" width="60" height="30" patternUnits="userSpaceOnUse">
            <rect width="60" height="30" fill="#3b322a" />
            <line x1="0" y1="15" x2="60" y2="15" stroke="#251f1a" stroke-width="2" />
            <line x1="30" y1="0" x2="30" y2="15" stroke="#251f1a" stroke-width="2" />
            <line x1="0" y1="15" x2="0" y2="30" stroke="#251f1a" stroke-width="2" />
            <line x1="60" y1="15" x2="60" y2="30" stroke="#251f1a" stroke-width="2" />
          </pattern>
          <linearGradient id="shoeLeather" x1="0%" y1="0%" x2="100%" y2="50%">
            <stop offset="0%" stop-color="#ffffff"/>
            <stop offset="70%" stop-color="#eaeaea"/>
            <stop offset="100%" stop-color="#d4d4d8"/>
          </linearGradient>
          <linearGradient id="shoeOrange" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#ff5500"/>
            <stop offset="100%" stop-color="#ff8800"/>
          </linearGradient>
          <linearGradient id="soleGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#18181b"/>
            <stop offset="100%" stop-color="#09090b"/>
          </linearGradient>
          <filter id="shadow">
            <feDropShadow dx="0" dy="15" stdDeviation="12" flood-color="#000" flood-opacity="0.6"/>
          </filter>
        </defs>
        <!-- Messy brick & concrete street background -->
        <rect width="800" height="550" fill="url(#brickPattern)" />
        <rect width="800" height="550" fill="rgba(0,0,0,0.4)" />
        <!-- Clutter elements: concrete sidewalk, coffee stain, street wire -->
        <rect y="550" width="800" height="250" fill="#2d2f33" />
        <line x1="0" y1="550" x2="800" y2="550" stroke="#4b4d52" stroke-width="4" />
        <!-- Pavement crack & stains -->
        <path d="M 50,600 Q 120,640 180,610 T 260,670" stroke="#1c1d1f" stroke-width="3" fill="none" />
        <ellipse cx="620" cy="650" rx="45" ry="18" fill="#1e1f21" opacity="0.6"/>
        <line x1="0" y1="200" x2="800" y2="280" stroke="#111" stroke-width="3" opacity="0.4"/>
        
        <!-- Luxury Sneaker with shadow -->
        <g filter="url(#shadow)">
          <!-- Sole -->
          <path d="M 160,540 C 200,560 300,565 420,560 C 530,555 600,530 630,490 C 640,475 620,470 580,480 C 480,500 320,505 200,485 C 160,480 145,510 160,540 Z" fill="url(#soleGrad)" />
          <path d="M 180,545 C 320,555 480,550 580,520 C 610,510 615,500 615,500 C 615,500 580,530 460,540 C 320,550 200,538 180,545 Z" fill="#ff5500" />
          <!-- Upper Body -->
          <path d="M 170,490 C 210,485 280,420 340,370 C 400,320 460,320 480,360 C 500,400 520,440 600,460 C 620,465 625,480 590,485 C 480,500 320,500 200,485 C 170,480 160,495 170,490 Z" fill="url(#shoeLeather)" stroke="#999" stroke-width="2" />
          <!-- Toe Cap & Heel Counter -->
          <path d="M 520,440 C 550,445 610,460 605,480 C 560,490 520,475 510,455 Z" fill="url(#shoeOrange)" />
          <path d="M 175,485 C 190,440 230,420 260,425 C 250,460 220,480 175,485 Z" fill="#18181b" />
          <!-- Swoosh / Dynamic Wave Accent -->
          <path d="M 260,440 C 330,465 430,460 520,410 C 450,445 350,440 270,415 Z" fill="url(#shoeOrange)" />
          <!-- Laces -->
          <path d="M 370,350 L 400,380 M 390,340 L 420,370 M 415,335 L 440,365 M 440,335 L 460,360" stroke="#ff8800" stroke-width="6" stroke-linecap="round" />
          <!-- Ankle Collar -->
          <path d="M 340,370 C 360,330 410,300 450,330 C 440,350 420,360 380,365 Z" fill="#27272a" />
        </g>
        <!-- Tag with barcode hanging (flaw to remove) -->
        <rect x="230" y="470" width="45" height="70" fill="#fff" stroke="#ccc" transform="rotate(15 230 470)"/>
        <line x1="235" y1="485" x2="265" y2="485" stroke="#111" stroke-width="2" transform="rotate(15 230 470)"/>
        <line x1="235" y1="495" x2="265" y2="495" stroke="#111" stroke-width="4" transform="rotate(15 230 470)"/>
        <line x1="235" y1="505" x2="265" y2="505" stroke="#111" stroke-width="1" transform="rotate(15 230 470)"/>
      </svg>
    `;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  if (type === 'cosmetics') {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">
        <defs>
          <linearGradient id="tileBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#b8c2cc"/>
            <stop offset="100%" stop-color="#7e8b9b"/>
          </linearGradient>
          <pattern id="bathroomTiles" width="80" height="80" patternUnits="userSpaceOnUse">
            <rect width="78" height="78" fill="#e2e8f0" rx="3"/>
            <rect x="78" width="2" height="80" fill="#94a3b8"/>
            <rect y="78" width="80" height="2" fill="#94a3b8"/>
          </pattern>
          <linearGradient id="amberGlass" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#542e11"/>
            <stop offset="25%" stop-color="#b26a27"/>
            <stop offset="60%" stop-color="#844a1b"/>
            <stop offset="85%" stop-color="#c67d36"/>
            <stop offset="100%" stop-color="#4a250a"/>
          </linearGradient>
          <linearGradient id="pipetteGold" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#b38728"/>
            <stop offset="50%" stop-color="#fbf5b7"/>
            <stop offset="100%" stop-color="#aa771c"/>
          </linearGradient>
          <filter id="softShadow">
            <feDropShadow dx="8" dy="16" stdDeviation="10" flood-color="#000" flood-opacity="0.35"/>
          </filter>
        </defs>
        <!-- Messy bathroom counter background -->
        <rect width="800" height="800" fill="url(#bathroomTiles)" />
        <rect y="580" width="800" height="220" fill="#cbd5e1" />
        <!-- Water droplets and clutter on counter -->
        <circle cx="240" cy="640" r="12" fill="#94a3b8" opacity="0.6"/>
        <circle cx="280" cy="620" r="8" fill="#94a3b8" opacity="0.5"/>
        <circle cx="560" cy="660" r="16" fill="#94a3b8" opacity="0.6"/>
        <rect x="100" y="480" width="90" height="150" rx="10" fill="#e2e8f0" stroke="#94a3b8" opacity="0.5"/>
        
        <!-- Amber Glass Dropper Bottle -->
        <g filter="url(#softShadow)">
          <!-- Bottle Body -->
          <rect x="330" y="320" width="140" height="270" rx="20" fill="url(#amberGlass)"/>
          <!-- Dropper Neck -->
          <rect x="375" y="270" width="50" height="50" rx="4" fill="url(#amberGlass)"/>
          <!-- Dropper Gold Collar -->
          <rect x="365" y="235" width="70" height="35" rx="3" fill="url(#pipetteGold)" stroke="#d97706" stroke-width="1"/>
          <!-- Rubber Bulb Top -->
          <path d="M 375,235 C 375,185 425,185 425,235 Z" fill="#1c1917"/>
          
          <!-- Product Label -->
          <rect x="345" y="370" width="110" height="150" rx="4" fill="#fafaf9" stroke="#e7e5e4"/>
          <!-- Text on label -->
          <text x="400" y="405" font-family="serif" font-size="14" font-weight="bold" fill="#1c1917" text-anchor="middle" letter-spacing="2">L'ESSENCE</text>
          <text x="400" y="425" font-family="sans-serif" font-size="9" fill="#78716c" text-anchor="middle" letter-spacing="1">BOTANICAL SERUM</text>
          <line x1="365" y1="438" x2="435" y2="438" stroke="#d6d3d1" stroke-width="1"/>
          <text x="400" y="460" font-family="sans-serif" font-size="8" fill="#44403c" text-anchor="middle">30 ML / 1.0 FL OZ</text>
          
          <!-- Glare / reflection on glass (flaw to clean up) -->
          <path d="M 338,340 Q 345,460 342,570" stroke="#ffffff" stroke-width="6" stroke-linecap="round" opacity="0.8"/>
          <!-- Water splash spots on label -->
          <circle cx="360" cy="480" r="5" fill="#d6d3d1" opacity="0.7"/>
          <circle cx="430" cy="495" r="7" fill="#d6d3d1" opacity="0.6"/>
        </g>
      </svg>
    `;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  if (type === 'watch') {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">
        <defs>
          <linearGradient id="deskWood" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#5c3a21"/>
            <stop offset="50%" stop-color="#3d2616"/>
            <stop offset="100%" stop-color="#24160c"/>
          </linearGradient>
          <linearGradient id="steelBezel" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#e2e8f0"/>
            <stop offset="25%" stop-color="#94a3b8"/>
            <stop offset="50%" stop-color="#f8fafc"/>
            <stop offset="75%" stop-color="#64748b"/>
            <stop offset="100%" stop-color="#cbd5e1"/>
          </linearGradient>
          <linearGradient id="leatherStrap" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#3b2012"/>
            <stop offset="50%" stop-color="#66391d"/>
            <stop offset="100%" stop-color="#2b170c"/>
          </linearGradient>
          <filter id="watchShadow">
            <feDropShadow dx="6" dy="18" stdDeviation="14" flood-color="#000" flood-opacity="0.5"/>
          </filter>
        </defs>
        <!-- Messy wooden desk with scratch lines & paper clips -->
        <rect width="800" height="800" fill="url(#deskWood)" />
        <line x1="120" y1="180" x2="350" y2="240" stroke="#784825" stroke-width="2" opacity="0.7"/>
        <line x1="450" y1="620" x2="680" y2="580" stroke="#784825" stroke-width="2" opacity="0.7"/>
        <!-- Coffee ring stain on desk (flaw to eliminate) -->
        <circle cx="220" cy="540" r="65" stroke="#2a180b" stroke-width="6" fill="none" opacity="0.6"/>
        
        <!-- Luxury Chronograph Watch -->
        <g filter="url(#watchShadow)">
          <!-- Top Strap -->
          <rect x="360" y="80" width="80" height="230" rx="8" fill="url(#leatherStrap)"/>
          <line x1="368" y1="90" x2="368" y2="300" stroke="#c29b62" stroke-width="2" stroke-dasharray="4,4"/>
          <line x1="432" y1="90" x2="432" y2="300" stroke="#c29b62" stroke-width="2" stroke-dasharray="4,4"/>
          <!-- Bottom Strap -->
          <rect x="360" y="490" width="80" height="230" rx="8" fill="url(#leatherStrap)"/>
          <line x1="368" y1="500" x2="368" y2="710" stroke="#c29b62" stroke-width="2" stroke-dasharray="4,4"/>
          <line x1="432" y1="500" x2="432" y2="710" stroke="#c29b62" stroke-width="2" stroke-dasharray="4,4"/>
          
          <!-- Watch Case / Outer Bezel -->
          <circle cx="400" cy="400" r="140" fill="url(#steelBezel)"/>
          <circle cx="400" cy="400" r="126" fill="#0f172a"/>
          <circle cx="400" cy="400" r="120" fill="#020617"/>
          
          <!-- Crown & Pushers -->
          <rect x="535" y="388" width="20" height="24" rx="3" fill="url(#steelBezel)"/>
          <rect x="525" y="325" width="16" height="18" rx="2" fill="url(#steelBezel)"/>
          <rect x="525" y="455" width="16" height="18" rx="2" fill="url(#steelBezel)"/>
          
          <!-- Dial Markings -->
          <circle cx="400" cy="400" r="115" stroke="#334155" stroke-width="1" fill="none"/>
          <text x="400" y="340" font-family="sans-serif" font-size="14" font-weight="bold" fill="#f8fafc" text-anchor="middle" letter-spacing="2">CHRONO</text>
          <text x="400" y="355" font-family="sans-serif" font-size="8" fill="#94a3b8" text-anchor="middle">AUTOMATIC</text>
          
          <!-- Subdials -->
          <circle cx="360" cy="400" r="22" stroke="#475569" stroke-width="1" fill="#090d16"/>
          <circle cx="440" cy="400" r="22" stroke="#475569" stroke-width="1" fill="#090d16"/>
          <circle cx="400" cy="445" r="22" stroke="#475569" stroke-width="1" fill="#090d16"/>
          
          <!-- Hands -->
          <line x1="400" y1="400" x2="400" y2="310" stroke="#f8fafc" stroke-width="4" stroke-linecap="round"/>
          <line x1="400" y1="400" x2="455" y2="425" stroke="#f8fafc" stroke-width="3" stroke-linecap="round"/>
          <line x1="400" y1="400" x2="355" y2="365" stroke="#ef4444" stroke-width="2" stroke-linecap="round"/>
          <circle cx="400" cy="400" r="6" fill="#f8fafc"/>
          
          <!-- Glass reflection & dust specks (imperfections to clean) -->
          <path d="M 330,310 Q 450,330 490,440" stroke="#ffffff" stroke-width="6" opacity="0.6" stroke-linecap="round" fill="none"/>
          <circle cx="370" cy="360" r="3" fill="#ffffff" opacity="0.8"/>
          <circle cx="430" cy="430" r="2" fill="#ffffff" opacity="0.7"/>
          <circle cx="410" cy="380" r="2.5" fill="#ffffff" opacity="0.9"/>
        </g>
      </svg>
    `;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  if (type === 'mug') {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">
        <defs>
          <linearGradient id="mugGlaze" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#1e293b"/>
            <stop offset="25%" stop-color="#0284c7"/>
            <stop offset="60%" stop-color="#0369a1"/>
            <stop offset="90%" stop-color="#0c4a6e"/>
            <stop offset="100%" stop-color="#082f49"/>
          </linearGradient>
          <linearGradient id="ceramicClay" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#d4b499"/>
            <stop offset="100%" stop-color="#b08b6d"/>
          </linearGradient>
          <filter id="mugShadow">
            <feDropShadow dx="8" dy="18" stdDeviation="12" flood-color="#000" flood-opacity="0.4"/>
          </filter>
        </defs>
        <!-- Messy kitchen counter background with crumbs and wires -->
        <rect width="800" height="800" fill="#f1f5f9" />
        <rect y="500" width="800" height="300" fill="#e2e8f0" />
        <line x1="0" y1="500" x2="800" y2="500" stroke="#cbd5e1" stroke-width="3" />
        <!-- Clutter: black power cord crossing background -->
        <path d="M 50,470 Q 200,530 400,480 T 750,520" stroke="#334155" stroke-width="8" fill="none" opacity="0.4"/>
        <circle cx="280" cy="560" r="4" fill="#64748b" opacity="0.5"/>
        <circle cx="540" cy="580" r="5" fill="#64748b" opacity="0.6"/>
        
        <!-- Ceramic Mug -->
        <g filter="url(#mugShadow)">
          <!-- Handle -->
          <path d="M 490,320 C 580,320 590,460 490,470" fill="none" stroke="url(#mugGlaze)" stroke-width="36" stroke-linecap="round"/>
          <!-- Mug Body -->
          <rect x="290" y="270" width="220" height="250" rx="15" fill="url(#mugGlaze)"/>
          <!-- Unfinished clay raw bottom -->
          <path d="M 290,490 L 510,490 L 505,520 L 295,520 Z" fill="url(#ceramicClay)"/>
          <!-- Rim Opening -->
          <ellipse cx="400" cy="270" rx="110" ry="24" fill="#0f172a"/>
          <!-- Steaming Coffee liquid inside -->
          <ellipse cx="400" cy="278" rx="98" ry="18" fill="#38220f"/>
          <!-- Glaze Highlights & Fingerprint Smudge (flaw to clean) -->
          <path d="M 320,300 Q 330,400 325,480" stroke="#ffffff" stroke-width="8" stroke-linecap="round" opacity="0.6"/>
          <!-- Fingerprint smudge on glossy surface -->
          <ellipse cx="420" cy="380" rx="22" ry="16" fill="#64748b" opacity="0.4"/>
        </g>
      </svg>
    `;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  // headphone
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">
      <defs>
        <linearGradient id="matteBlack" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#27272a"/>
          <stop offset="50%" stop-color="#18181b"/>
          <stop offset="100%" stop-color="#09090b"/>
        </linearGradient>
        <linearGradient id="metalArm" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#d4d4d8"/>
          <stop offset="50%" stop-color="#71717a"/>
          <stop offset="100%" stop-color="#3f3f46"/>
        </linearGradient>
        <filter id="hpShadow">
          <feDropShadow dx="10" dy="20" stdDeviation="15" flood-color="#000" flood-opacity="0.45"/>
        </filter>
      </defs>
      <!-- Messy bedroom carpet and bed sheet background -->
      <rect width="800" height="800" fill="#3f3f46" />
      <path d="M 0,200 Q 400,350 800,220 L 800,800 L 0,800 Z" fill="#27272a" opacity="0.6"/>
      <!-- Crumpled bed sheet wrinkles -->
      <path d="M 100,500 Q 300,580 500,520 T 780,600" stroke="#18181b" stroke-width="4" fill="none" opacity="0.5"/>
      <path d="M 50,680 Q 250,720 450,660 T 700,740" stroke="#18181b" stroke-width="5" fill="none" opacity="0.4"/>
      
      <!-- Studio Wireless Headphones -->
      <g filter="url(#hpShadow)">
        <!-- Headband Arc -->
        <path d="M 280,420 C 260,200 540,200 520,420" fill="none" stroke="url(#matteBlack)" stroke-width="44" stroke-linecap="round"/>
        <path d="M 320,330 C 320,240 480,240 480,330" fill="none" stroke="#3f3f46" stroke-width="14" stroke-linecap="round"/>
        <!-- Adjustment Metal Sliders -->
        <rect x="252" y="380" width="16" height="50" rx="3" fill="url(#metalArm)"/>
        <rect x="532" y="380" width="16" height="50" rx="3" fill="url(#metalArm)"/>
        <!-- Left Ear Cup -->
        <ellipse cx="255" cy="460" rx="55" ry="75" fill="url(#matteBlack)"/>
        <ellipse cx="270" cy="460" rx="28" ry="60" fill="#09090b"/>
        <!-- Right Ear Cup -->
        <ellipse cx="545" cy="460" rx="55" ry="75" fill="url(#matteBlack)"/>
        <ellipse cx="530" cy="460" rx="28" ry="60" fill="#09090b"/>
        <!-- Logo on outer cup -->
        <circle cx="238" cy="460" r="18" fill="none" stroke="#71717a" stroke-width="3"/>
        <!-- Cable & dust speck flaws to remove -->
        <circle cx="250" cy="440" r="3" fill="#fff" opacity="0.7"/>
        <circle cx="550" cy="480" r="2.5" fill="#fff" opacity="0.6"/>
      </g>
    </svg>
  `;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const SAMPLE_PRODUCTS: SampleProduct[] = [
  {
    id: 'sample-sneaker',
    name: 'Streetwear Runner Sneaker',
    category: 'Footwear',
    thumbnail: createSampleImage('sneaker'),
    suggestedInstruction: 'Remove the concrete street background and isolate sneaker on pure studio white (#FFFFFF). Remove the hanging barcode tag and add a soft contact ground shadow.',
    description: 'Messy asphalt street background with unwanted barcode tag.',
  },
  {
    id: 'sample-cosmetics',
    name: 'Luxury Botanical Serum',
    category: 'Beauty & Skincare',
    thumbnail: createSampleImage('cosmetics'),
    suggestedInstruction: 'Remove the cluttered bathroom tile background and isolate the dropper bottle on pure white. Clean up harsh reflection glare and water smudges on the label.',
    description: 'Cluttered bathroom tile counter, water droplets, and reflection glare.',
  },
  {
    id: 'sample-watch',
    name: 'Chronograph Steel Watch',
    category: 'Jewelry & Watches',
    thumbnail: createSampleImage('watch'),
    suggestedInstruction: 'Remove the wood desk background and coffee ring. Place on pure seamless white with a soft elegant reflection. Remove dust particles and glare on the watch crystal.',
    description: 'Wooden desk with coffee stain, glass reflection glare, and dust particles.',
  },
  {
    id: 'sample-mug',
    name: 'Artisanal Ceramic Glaze Mug',
    category: 'Home & Kitchen',
    thumbnail: createSampleImage('mug'),
    suggestedInstruction: 'Remove the kitchen background and power cable. Place on a warm minimalist studio setting. Clean fingerprint smudges off the glazed surface.',
    description: 'Power cable clutter and fingerprint smudges on glazed surface.',
  },
  {
    id: 'sample-headphone',
    name: 'Pro Wireless ANC Headphones',
    category: 'Electronics',
    thumbnail: createSampleImage('headphone'),
    suggestedInstruction: 'Remove the bed sheet background and float the headphones on an Amazon-compliant pure white (#FFFFFF) background with natural softbox lighting.',
    description: 'Messy bedroom sheets background and surface lint.',
  },
];
