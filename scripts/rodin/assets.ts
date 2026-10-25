/**
 * Every Rodin-generated shape, in one place so the whole batch can move at once.
 * `bun run rodin brief` writes the image prompts (reference images) and the
 * Rodin upload lists, `bun run rodin bake` bakes every new or changed GLB in
 * parallel, and `bun run rodin status` shows what is left. Changing `tris`,
 * `colours` or `clean` marks the baked file stale.
 */
export interface RodinAsset {
  /** File stem: `.rodin/refs/<name>/`, `.rodin/<name>.glb`, `src/cities/shapes/<name>.shape.ts`. */
  name: string;
  /** City slugs that place it. */
  cities: string[];
  /** The procedural builder(s) it replaces, for whoever integrates it. */
  replaces: string;
  /** Short name of the subject. */
  subject: string;
  /** Shape description for the reference images: proportions first, then parts, then what faces the front. */
  look: string;
  /**
   * Each flat colour area as `area: colour name (#hex)`, matching the city's
   * palette. One baked part per entry, so the bake splits the model exactly
   * along these areas and each gets one city material.
   */
  colours: string[];
  /** Things this subject tends to drag in that must stay out of the image. */
  exclude?: string[];
  /**
   * Identity source attached to the front prompt: pixel rect `[x, y, w, h]` in
   * `assets/<name>.jpeg`. Only when the poster shows the subject large and
   * unobstructed (roughly 120 px or more across).
   */
  poster?: { name: string; crop: [number, number, number, number] };
  /** Triangle target after simplification. */
  tris: number;
  /** Speckle-cleaning passes (default 2). */
  clean?: number;
  /**
   * Bake `.rodin/<from>.glb` instead of `.rodin/<name>.glb`: a lighter variant of another
   * asset's model for a city that places many copies. The reference image and the Rodin
   * run belong to `from`.
   */
  from?: string;
}

const MOTORBIKE: RodinAsset = {
  name: 'motorbike',
  cities: ['hanoi'],
  replaces: 'hanoi.ts motorbikePair() (animated: mergeStatic before Animator)',
  subject: 'a Vietnamese motor scooter with its rider',
  look:
    'A small step-through motor scooter (like a Honda Wave) seen whole, both wheels on the same level, with a rider seated upright, ' +
    'both hands on the handlebar and both feet on the footrests. The rider wears a long-sleeve shirt, trousers and a conical ' +
    'non la hat. Front = the headlight and the rider\'s face, facing the viewer.',
  colours: [
    'scooter body panels: red (#c8433a)',
    'rider shirt and jacket: mid grey (#6a6f76)',
    'tyres, seat, trousers and hair: dark charcoal (#2e3238)',
    'conical hat: straw (#e8d9a8)',
  ],
  exclude: ['passenger', 'cargo', 'road', 'motion blur', 'helmet'],
  tris: 1500,
};

export const ASSETS: RodinAsset[] = [
  {
    name: 'sphinx',
    cities: ['cairo'],
    replaces: 'cairo.ts sphinx()',
    subject: 'the Great Sphinx of Giza',
    look:
      'A reclining lion with a human pharaoh head, lying low and long: the body is about three times longer than it is tall. ' +
      'Both front paws stretch straight forward side by side, long and flat on the ground. The rump is rounded, hind legs folded ' +
      'along the flanks, tail curled along the right hip. The head sits upright on a thick neck and wears the royal nemes headdress: ' +
      'a cloth with broad horizontal stripes over the top of the head, flaring out behind the face, with two striped lappets falling ' +
      'down to the chest on both sides. The face is flat and weathered, with no nose. Front = the face, looking straight at the viewer.',
    // Ochre light stripes sat between the lit and shaded sandstone in Gemini's
    // render, so the bake could not separate them from the body: two areas only.
    colours: [
      'lion body, paws, face and the light stripes of the headdress: warm sandstone (#d9a45a)',
      'dark stripes of the headdress: dark brown (#8f6a38)',
    ],
    exclude: ['pyramids', 'sand dunes', 'rock enclosure or pit around the body'],
    // Thin headdress stripes need the extra triangles, and only one cleanup pass so they are not voted away.
    tris: 5000,
    clean: 1,
  },
  {
    name: 'camel',
    cities: ['cairo', 'dubai'],
    replaces: 'cairo.ts camel(), dubai.ts camel()',
    subject: 'a standing dromedary camel',
    look:
      'A dromedary (one hump) standing still on four long thin legs with knobbly knees, all four hooves flat on the same level. ' +
      'One rounded hump in the middle of the back, a long neck curving forward and up, a small head held level, short tail hanging down. ' +
      'A flat saddle blanket lies over the hump and hangs down both flanks. Front = the head, facing the viewer.',
    colours: ['camel body, legs and head: tan (#c89a62)', 'saddle blanket: red (#c8433a)'],
    exclude: ['rider', 'reins or ropes hanging loose', 'desert ground'],
    tris: 600,
  },
  {
    name: 'felucca',
    cities: ['cairo'],
    replaces: 'cairo.ts felucca() (animated: mergeStatic before Animator)',
    subject: 'an Egyptian felucca sailboat',
    look:
      'A small open wooden sailboat about four times longer than it is wide, with a gently curved hull, a pointed raised bow and a ' +
      'rounded stern. One short mast near the bow carries a long yard slanted steeply backwards, from which hangs one large ' +
      'triangular lateen sail, taller than the hull is long, filled with wind. The underside of the hull is fully visible, ' +
      'as if lifted out of the water. Front = the bow, pointing at the viewer.',
    colours: ['hull, mast and yard: dark brown wood (#8a5a3a)', 'sail: off-white canvas (#f4efe2)'],
    exclude: ['water', 'waves', 'sailors', 'ropes as thin lines'],
    tris: 800,
  },
  {
    name: 'christ-redeemer',
    cities: ['rio-de-janeiro'],
    replaces: 'rio-de-janeiro.ts christ() (sits on corcovado())',
    subject: 'the Christ the Redeemer statue',
    look:
      'An Art Deco statue of a standing robed figure with both arms stretched straight out horizontally, forming a cross; the arm span ' +
      'equals the height of the figure. A long robe with simple straight vertical folds reaches the feet, a sash at the waist, the head ' +
      'slightly lowered. It stands on a square pedestal that is a quarter of the figure height, slightly tapered, with a plain cornice. ' +
      'Front = the face and chest, facing the viewer.',
    colours: ['statue and pedestal: pale soapstone white (#f6f5ef)'],
    exclude: ['mountain', 'Corcovado summit', 'clouds', 'scaffolding'],
    tris: 2000,
  },
  {
    name: 'sugarloaf',
    cities: ['rio-de-janeiro'],
    replaces: 'rio-de-janeiro.ts sugarloaf()',
    subject: 'Sugarloaf Mountain (Pão de Açúcar)',
    look:
      'A single tall bullet-shaped granite monolith rising steeply from a small oval footprint, about 1.5 times taller than it is wide, ' +
      'with a smooth rounded top and near-vertical bare rock faces. Dense rounded forest covers the lower third and the foot all ' +
      'around, climbing higher in a few gullies. The bottom is cut flat and level, as if the mountain were lifted off the sea. ' +
      'Front = the steepest, barest face.',
    colours: ['bare rock: warm granite grey (#a6a39a)', 'forest: green (#4f9444)'],
    exclude: ['sea or water', 'cable car', 'second hill (Morro da Urca)', 'city', 'beach'],
    tris: 2500,
  },
  {
    name: 'statue-of-liberty',
    cities: ['new-york'],
    replaces: 'new-york.ts statueOfLiberty()',
    subject: 'the Statue of Liberty',
    look:
      'The robed copper statue holding a torch high in her raised right arm and a tablet against her body with her left arm, wearing a ' +
      'crown with seven pointed rays. She stands on a tall square granite pedestal with a cornice and small window openings, about as ' +
      'tall as the statue, which stands on the low eleven-pointed star-shaped fort walls of Fort Wood. Front = her face, facing the viewer.',
    colours: [
      'statue, torch and tablet: pale copper green (#72b9a0)',
      'pedestal: warm granite beige (#b8a68c)',
      'star fort walls and their top: light stone (#d9d2c3)',
    ],
    exclude: ['snow', 'water', 'trees', 'flag', 'skyscrapers'],
    poster: { name: 'new-york', crop: [38, 385, 124, 215] },
    tris: 3000,
  },
  {
    name: 'dhow',
    cities: ['dubai'],
    replaces: 'dubai.ts dhow() (animated: mergeStatic before Animator)',
    subject: 'a traditional Arabian dhow',
    look:
      'A wooden dhow about four times longer than it is wide: a deep curved hull with a long pointed bow rising forward and a high square ' +
      'stern with a small raised deck house. One mast leaning slightly forward carries a long slanted yard with a furled cream lateen ' +
      'sail bundled along it. The underside of the hull is fully visible, as if lifted out of the water. Front = the bow, pointing at the viewer.',
    colours: ['hull, deck house and mast: medium brown wood (#8a5a35)', 'furled sail: cream (#efe6d2)'],
    exclude: ['water', 'waves', 'crew', 'cargo piles', 'ropes as thin lines'],
    tris: 800,
  },
  {
    name: 'trevi-sculptures',
    cities: ['rome'],
    replaces: 'the rocky mass in front of the arch in rome.ts trevi()',
    subject: 'the sculpture group of the Trevi Fountain',
    look:
      'Only the free-standing sculpture group, without the palace facade behind it: a wide, low mass of rough carved travertine rocks, ' +
      'about three times wider than tall and flat at the back. In the centre, the statue of Oceanus stands on a large scallop-shell ' +
      'chariot; in front of him two winged sea horses rear out of the rocks, each led by a triton, one horse calm on the left and one ' +
      'wild on the right. Front = Oceanus facing the viewer.',
    colours: ['rocks and shell chariot: warm travertine (#d3c09c)', 'statues and sea horses: white marble (#ece6d8)'],
    exclude: ['palace facade', 'columns', 'niche arch', 'water', 'basin', 'tourists', 'coins'],
    tris: 2500,
  },
  MOTORBIKE,
  // The same scooter baked lighter: the Ho Chi Minh City swarms need two to three times as many riders in the budget.
  {
    ...MOTORBIKE,
    name: 'motorbike-lite',
    cities: ['ho-chi-minh'],
    replaces: 'the motorbike swarms in ho-chi-minh.ts (the Hanoi scooter, baked lighter)',
    from: 'motorbike',
    tris: 700,
  },
  {
    name: 'muhammad-ali-mosque',
    cities: ['cairo'],
    replaces: 'the mosque proper and courtyard in cairo.ts muhammadAli() (keep the citadel plateau, towers and both minarets)',
    subject: 'the Mosque of Muhammad Ali in the Cairo Citadel, without its minarets',
    look:
      'An Ottoman mosque about twice as deep as it is wide, seen from a high three-quarter view. At the back, a square prayer hall ' +
      'with a large central dome on a short drum ringed by small arched windows; around it four half-domes step down on the four ' +
      'sides, with four small domes on the corners, forming a smooth cascade of domes. In front, a square open courtyard of the same ' +
      'width, surrounded on three sides by a low arcade of round arches, each bay roofed by a small dome; in the middle of the courtyard ' +
      'a small octagonal fountain pavilion under a dome. Thick plain walls, no minarets. Front = the courtyard, facing the viewer.',
    colours: ['walls, arcades, drum and fountain: pale alabaster (#e6dcc3)', 'all domes and half-domes: lead grey (#9ba6ad)'],
    exclude: ['minarets', 'towers', 'citadel walls', 'hill or rock base', 'people', 'gold crescents', 'clock tower'],
    tris: 3000,
  },
  {
    name: 'corcovado',
    cities: ['rio-de-janeiro'],
    replaces: 'rio-de-janeiro.ts corcovado() (keep christ() on the summit platform)',
    subject: 'Corcovado mountain in Rio de Janeiro, without the statue',
    look:
      'A tall, steep granite mountain about one and a half times taller than it is wide at the base, like a thick leaning tower of ' +
      'rock, not a wide hill. The lower third is a narrow skirt of rainforest drawn as a few large smooth rounded canopy masses, not ' +
      'many small bumps. Above it a tall bare granite peak, slightly hunched backward, with one sheer, smooth, almost vertical cliff ' +
      'face on the front running from the forest to the summit. The summit ends in a small flat square platform, empty, ready for a ' +
      'statue. Front = the sheer granite cliff, facing the viewer.',
    colours: ['rainforest: mid green (#4f9444)', 'bare granite rock and summit platform: warm grey (#a6a39a)'],
    exclude: ['Christ the Redeemer statue', 'buildings', 'roads', 'railway', 'clouds', 'sea', 'city'],
    tris: 3000,
  },
  {
    name: 'batu-cliff',
    cities: ['kuala-lumpur'],
    replaces: 'the rock cylinders and trees in kuala-lumpur.ts batuCaves() (keep the rainbow stairs, cave portico and murugan())',
    subject: 'the limestone hill of the Batu Caves in Malaysia',
    look:
      'A tall limestone hill a little taller than it is wide, with a rounded top: sheer pale cliffs with vertical flutes and ' +
      'overhangs, and ledges and the top covered in dense jungle. One large dark arched cave mouth opens on the front face about ' +
      'one third of the way up. The ground in front of the cliff is a small flat foot where a stairway would start. ' +
      'Front = the cave mouth, facing the viewer.',
    colours: [
      'cliff faces: pale tan limestone (#b7a48b)',
      'jungle on the ledges and top: leaf green (#5fa046)',
      'cave mouth interior: very dark brown (#23190f)',
    ],
    exclude: ['stairs', 'statue', 'temple', 'people', 'monkeys', 'buildings'],
    tris: 5000,
  },
  {
    name: 'murugan-statue',
    cities: ['kuala-lumpur'],
    replaces: 'the figure in kuala-lumpur.ts murugan() (keep its stepped plinth boxes)',
    subject: 'the golden Lord Murugan statue at the Batu Caves, without its plinth',
    look:
      'A standing Hindu deity about three times taller than it is wide: a tall crown, a calm face, a bare chest with necklaces, a ' +
      'draped dhoti down to the feet. The left hand holds a tall vertical spear (vel) with a leaf-shaped blade, reaching above the ' +
      'crown; the right hand is raised in blessing. Feet on a thin flat base. Front = the face, facing the viewer.',
    colours: ['whole statue, spear included: gold (#e1b13a)'],
    exclude: ['plinth', 'pedestal', 'cliff', 'stairs', 'peacock', 'flowers', 'people'],
    tris: 2500,
  },
  {
    name: 'landmark-81',
    cities: ['ho-chi-minh'],
    replaces: 'ho-chi-minh.ts landmark81() tower and podium (the reference also has a square base plate, sunk below ground when placed; keep the flags)',
    subject: 'the Landmark 81 skyscraper in Ho Chi Minh City',
    look:
      'A very tall glass skyscraper made of nine square tubes bundled like bamboo stalks: the outer tubes stop at different heights, ' +
      'so the tower steps up towards the tallest central tube, which carries a slim crown and a needle spire. Pale frames outline ' +
      'every tube; it stands on a low stepped podium. Front = the podium entrance, facing the viewer.',
    colours: ['glass tubes and podium glazing: dark steel blue (#3f5468)', 'frames, setback roofs, podium and spire: pale grey-white (#dfe7ee)'],
    exclude: ['text', 'people', 'other buildings', 'ground', 'shadow'],
    tris: 5000,
  },
];
