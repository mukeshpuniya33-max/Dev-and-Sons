export interface PresetInstruction {
  id: string;
  category: 'background' | 'cleanup' | 'lighting' | 'staging';
  label: string;
  instruction: string;
  description: string;
  iconName: string;
}

export const PRESET_INSTRUCTIONS: PresetInstruction[] = [
  // Background presets
  {
    id: 'bg-pure-white',
    category: 'background',
    label: 'Amazon Pure White (#FFFFFF)',
    instruction: 'Remove the background completely. Isolate the product on a pure, seamless e-commerce studio white background (#FFFFFF) with a delicate, realistic soft contact ground shadow.',
    description: '100% compliant with Amazon, Shopify, and Google Shopping requirements.',
    iconName: 'Maximize2',
  },
  {
    id: 'bg-transparent',
    category: 'background',
    label: 'Transparent Cutout',
    instruction: 'Isolate the product with precise, razor-sharp edges and remove all background elements completely, leaving the background fully transparent without any halo or fringing.',
    description: 'Crisp cutout ideal for graphic banners, catalogs, and compositing.',
    iconName: 'Layers',
  },
  {
    id: 'bg-pedestal',
    category: 'background',
    label: 'Travertine Stone Pedestal',
    instruction: 'Remove the background and place the product on a minimalist beige travertine marble podium with warm diffused studio morning light and soft gentle shadows.',
    description: 'Elevated luxury staging for cosmetics, jewelry, and lifestyle products.',
    iconName: 'Box',
  },
  {
    id: 'bg-oak-wood',
    category: 'background',
    label: 'Warm Oak Studio Table',
    instruction: 'Remove background and place the product on a smooth natural oak wooden studio surface with warm directional side lighting and gentle soft-focus background.',
    description: 'Organic, warm, artisanal aesthetic for food, home goods, and craft.',
    iconName: 'Coffee',
  },
  {
    id: 'bg-dark-dramatic',
    category: 'background',
    label: 'Moody Cyber Black Podium',
    instruction: 'Remove the background and place the product on a matte dark slate platform with high-contrast commercial rim lighting and deep subtle shadows.',
    description: 'Striking tech aesthetic for headphones, gaming gear, and luxury watches.',
    iconName: 'Moon',
  },

  // Cleanup presets
  {
    id: 'clean-dust-smudges',
    category: 'cleanup',
    label: 'Clean Dust & Fingerprints',
    instruction: 'Carefully clean up all dust specks, lint, fingerprints, and smudge marks from the product surface while preserving brand logos, textures, and fine material finishes.',
    description: 'Restores glossy and matte materials to factory-fresh perfection.',
    iconName: 'Sparkles',
  },
  {
    id: 'clean-glare-reflections',
    category: 'cleanup',
    label: 'Eliminate Glare & Harsh Reflections',
    instruction: 'Remove distracting hot spots, blown-out white flash glare, and harsh reflections from metallic and glass surfaces, replacing them with even diffused studio illumination.',
    description: 'Eliminates distracting photographer or room reflections on bottles & metal.',
    iconName: 'Sun',
  },
  {
    id: 'clean-tags-stickers',
    category: 'cleanup',
    label: 'Remove Price Tags & Barcodes',
    instruction: 'Detect and seamlessly remove all hanging tags, price stickers, barcode labels, and adhesive residue from the item, filling the texture naturally.',
    description: 'Effortlessly removes unwanted retail tags and strings.',
    iconName: 'Tag',
  },
  {
    id: 'clean-wrinkles-scuffs',
    category: 'cleanup',
    label: 'Smooth Scuffs & Wrinkles',
    instruction: 'Clean and smooth out fabric wrinkles, scuff marks, and minor surface scratches while keeping the authentic material weave and structure sharp.',
    description: 'Perfect for apparel, footwear, leather goods, and packaging.',
    iconName: 'Wand2',
  },

  // Lighting & Shadows
  {
    id: 'light-contact-shadow',
    category: 'lighting',
    label: 'Realistic Drop Contact Shadow',
    instruction: 'Keep the product crisp and anchor it firmly by adding a natural, soft-edged diffused ground contact shadow directly beneath the base.',
    description: 'Prevents the product from looking like a flat sticker floating in air.',
    iconName: 'ShieldAlert',
  },
  {
    id: 'light-mirror-reflection',
    category: 'lighting',
    label: 'Subtle Glass Floor Reflection',
    instruction: 'Place the product on an elegant polished high-gloss white studio surface with a soft, faded vertical mirror reflection beneath the base.',
    description: 'Premium tech and perfume catalog appearance.',
    iconName: 'FlipVertical',
  },
  {
    id: 'light-softbox',
    category: 'lighting',
    label: '3-Point Softbox Lighting',
    instruction: 'Rebalance the lighting with professional commercial 3-point softbox studio lighting, adding a subtle key light, soft fill, and crisp rim light.',
    description: 'Brings out rich depth, micro-contrast, and dimensional form.',
    iconName: 'Lightbulb',
  },

  // Staging & Special
  {
    id: 'stage-ghost-mannequin',
    category: 'staging',
    label: 'Ghost Mannequin / Floating Garment',
    instruction: 'Remove the mannequin neck, hanger, and stand. Reconstruct the interior inner collar lining and create a 3D hollow floating ghost mannequin effect on seamless white.',
    description: 'Industry-standard garment catalog photography technique.',
    iconName: 'Shirt',
  },
  {
    id: 'stage-remove-hand',
    category: 'staging',
    label: 'Remove Holding Hand / Fingers',
    instruction: 'Remove the hand, fingers, and arm holding or supporting the item. Inpaint and restore the covered product parts with flawless natural texture and form.',
    description: 'Cleans up quick handheld smartphone product shots.',
    iconName: 'Hand',
  },
];
