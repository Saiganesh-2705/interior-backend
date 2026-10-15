require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Project = require('./models/Project');
const Service = require('./models/Service');
const Testimonial = require('./models/Testimonial');
const Enquiry = require('./models/Enquiry');

const u = (id, w = 1400) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;
const IMG = {
  living1: '1618221195710-dd6b41faaea6', living2: '1583847268964-b28dc8f51f92', living3: '1615873968403-89e068629265',
  bed1: '1616486338812-3dadae4b4ace', bed2: '1560448204-e02f11c3d0e2',
  kitchen1: '1556909114-f6e7ad7d3136', kitchen2: '1600607687939-ce8a6c25118c',
  home1: '1600210492486-724fe5c67fb0', home2: '1600585154340-be6161a56a0c', home3: '1600566753190-17f0baa2a6c3',
  office1: '1497366216548-37526070297c', office2: '1497366811353-6870744d04b2'
};

const projects = [
  { title: 'Marina Heights Residence', category: 'Full home', style: 'Warm minimal', location: 'Chennai', areaSqft: 2100, year: 2025, featured: true,
    summary: 'A 3 BHK rebuilt around natural light, oak joinery and a single continuous floor.',
    description: 'The family wanted a calm home that could handle two children and weekly guests. We removed two partition walls, ran one oak floor through every room and tucked storage into full-height joinery so the surfaces stay clear. Lighting is layered: concealed cove lights, task lamps and dimmable pendants over the dining table.',
    cover: u(IMG.home1), gallery: [u(IMG.living1), u(IMG.bed1), u(IMG.kitchen1)] },
  { title: 'Lakeview Living Room', category: 'Living room', style: 'Modern luxe', location: 'Coimbatore', areaSqft: 480, year: 2025, featured: true,
    summary: 'A double-height living room with a stone feature wall and brass detailing.',
    description: 'The brief was a room that feels grand but still comfortable for family evenings. A honed stone wall anchors the space, low seating keeps sightlines open to the lake, and brass accents repeat in the lighting, side tables and shelf edges.',
    cover: u(IMG.living1), gallery: [u(IMG.living2), u(IMG.living3)] },
  { title: 'The Quiet Bedroom', category: 'Bedroom', style: 'Scandinavian', location: 'Madurai', areaSqft: 260, year: 2024, featured: true,
    summary: 'A restful master bedroom in soft greys, linen and pale ash wood.',
    description: 'Blackout curtains with a sheer layer, a upholstered headboard wall for sound absorption and warm 2700K lighting keep this room built for sleep. A concealed wardrobe wall leaves the room free of visual clutter.',
    cover: u(IMG.bed1), gallery: [u(IMG.bed2)] },
  { title: 'Courtyard Kitchen', category: 'Kitchen', style: 'Contemporary', location: 'Pondicherry', areaSqft: 190, year: 2025, featured: true,
    summary: 'An island kitchen with quartz tops, handleless shutters and a breakfast bar.',
    description: 'A U-shaped layout was replaced with an island plan so two people can cook together. Handleless shutters, a full-height pantry and under-cabinet lighting keep the room clean and practical.',
    cover: u(IMG.kitchen1), gallery: [u(IMG.kitchen2)] },
  { title: 'Studio Nine Workspace', category: 'Office', style: 'Industrial', location: 'Bengaluru', areaSqft: 3200, year: 2024, featured: false,
    summary: 'An open design studio with acoustic ceilings, meeting pods and a long shared table.',
    description: 'We kept the exposed concrete ceiling, added acoustic baffles and zoned the plan into focus desks, a long collaboration table and two glass meeting pods.',
    cover: u(IMG.office1), gallery: [u(IMG.office2)] },
  { title: 'Palm Grove Villa', category: 'Full home', style: 'Modern luxe', location: 'Chennai', areaSqft: 4200, year: 2024, featured: false,
    summary: 'A four-bedroom villa with a double-height foyer and a connected garden deck.',
    description: 'A new-build interior planned from the first drawings: double-height foyer, a lounge that opens onto the garden deck and a family room on the upper level.',
    cover: u(IMG.home2), gallery: [u(IMG.home3), u(IMG.living2)] },
  { title: 'Sunroom Lounge', category: 'Living room', style: 'Warm minimal', location: 'Trichy', areaSqft: 320, year: 2023, featured: false,
    summary: 'A compact lounge using texture and layered lighting instead of extra furniture.',
    description: 'Small rooms need fewer, better pieces. Boucle seating, a travertine coffee table and wall washers make this lounge feel larger than its size.',
    cover: u(IMG.living3), gallery: [u(IMG.living2)] },
  { title: 'Teak and Linen Bedroom', category: 'Bedroom', style: 'Classic', location: 'Salem', areaSqft: 280, year: 2023, featured: false,
    summary: 'A classic bedroom with panelled walls, teak furniture and a reading corner.',
    description: 'Panelled walls and a teak bed frame give the room warmth, while a window-side reading corner makes it useful during the day.',
    cover: u(IMG.bed2), gallery: [u(IMG.bed1)] },
  { title: 'Riverside Apartment', category: 'Full home', style: 'Contemporary', location: 'Vellore', areaSqft: 1250, year: 2025, featured: false,
    summary: 'A 2 BHK with hidden storage, a work nook and a kitchen that opens to the living area.',
    description: 'Every wall in this apartment works twice: storage under the window seat, a fold-away desk in the living room and a pass-through connecting kitchen and dining.',
    cover: u(IMG.home3), gallery: [u(IMG.kitchen2), u(IMG.living1)] }
];

const services = [
  { order: 1, title: 'Residential interiors', image: u(IMG.living2, 1000),
    summary: 'Complete design for apartments, villas and independent homes.',
    details: 'From first sketch to final styling, we plan layouts, storage, lighting and finishes for the way your household actually lives.',
    features: ['Space planning and layout options', '3D visuals before you commit', 'Furniture, lighting and decor selection', 'Single-point site supervision'] },
  { order: 2, title: 'Modular kitchens', image: u(IMG.kitchen2, 1000),
    summary: 'Kitchens planned around how you cook, with durable hardware and finishes.',
    details: 'We design the work triangle, storage and ventilation first, then pick shutters and counters that suit your budget and cleaning habits.',
    features: ['Island, L-shaped, U-shaped and parallel layouts', 'Soft-close hardware and pull-out storage', 'Quartz, granite and solid-surface counters', 'Appliance and chimney planning'] },
  { order: 3, title: 'Bedrooms and wardrobes', image: u(IMG.bed1, 1000),
    summary: 'Restful bedrooms with made-to-measure wardrobes and good lighting.',
    details: 'We design for sleep first: light control, noise, ventilation and storage that keeps the room clear.',
    features: ['Custom wardrobes and dressing units', 'Headboard walls and upholstery', 'Layered, dimmable lighting', 'Kids and guest bedroom planning'] },
  { order: 4, title: 'Office and retail', image: u(IMG.office2, 1000),
    summary: 'Workplaces and shops that suit your team, your brand and your customers.',
    details: 'We plan the floor around workflow or footfall, then add acoustics, lighting and branding.',
    features: ['Workspace and showroom planning', 'Acoustic and lighting design', 'Brand-led finishes and signage', 'Phased execution to limit downtime'] },
  { order: 5, title: 'Turnkey execution', image: u(IMG.home1, 1000),
    summary: 'Our own team builds what we design, to a fixed scope and schedule.',
    details: 'Carpentry, electrical, painting and finishing are managed by one site team, with weekly progress updates.',
    features: ['Fixed-scope quotation', 'Weekly site reports with photos', 'Quality checks at each stage', 'Handover with care guide'] },
  { order: 6, title: 'Design consultation', image: u(IMG.living3, 1000),
    summary: 'Hourly sessions for people who want expert advice and will manage the work themselves.',
    details: 'Bring your plan and we will review layout, colours, lighting and budget, and give you a clear room-by-room direction.',
    features: ['Layout and furniture review', 'Colour and material palette', 'Shopping list with budgets', 'Follow-up call after two weeks'] }
];

const testimonials = [
  { name: 'Priya Raman', place: 'Marina Heights, Chennai', rating: 5, quote: 'They changed our layout in ways we would never have thought of, and the 3D views meant there were no surprises at handover.' },
  { name: 'Karthik Subramanian', place: 'Lakeview, Coimbatore', rating: 5, quote: 'The site team was on time every week and the photo updates meant we could follow progress from another city.' },
  { name: 'Meera Nair', place: 'Courtyard Kitchen, Pondicherry', rating: 5, quote: 'I cook every day, and the kitchen works the way I do. The drawers alone were worth it.' },
  { name: 'Arjun Mehta', place: 'Studio Nine, Bengaluru', rating: 4, quote: 'They delivered our office in phases so the team never stopped working. The acoustics made a real difference.' }
];

(async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/luxe-interiors');
  await Promise.all([Project.deleteMany(), Service.deleteMany(), Testimonial.deleteMany(), Enquiry.deleteMany()]);
  await Project.insertMany(projects);
  await Service.insertMany(services);
  await Testimonial.insertMany(testimonials);

  const email = (process.env.ADMIN_EMAIL || 'admin@luxeinteriors.com').toLowerCase();
  await User.deleteOne({ email });
  await User.create({ name: 'Studio Admin', email, password: process.env.ADMIN_PASSWORD || 'Admin@123', role: 'admin' });

  console.log(`Seeded ${projects.length} projects, ${services.length} services, ${testimonials.length} testimonials.`);
  console.log(`Admin login: ${email} / ${process.env.ADMIN_PASSWORD || 'Admin@123'}`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
