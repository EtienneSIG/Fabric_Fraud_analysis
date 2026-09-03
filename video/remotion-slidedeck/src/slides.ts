// Demo flow + timing for the Fraud Intelligence guided slide deck.
// Each slide maps to a README screenshot in ./public and a presenter cue.

export type SlideData = {
  image: string; // filename in public/ — the still, and the poster behind a video
  video?: string; // filename in public/ — when set, the slide plays this clip instead of the still
  placeholder?: boolean; // true = the clip is a stand-in awaiting a Scout recording (shows a REC badge)
  frames?: number; // per-slide duration override (defaults to SLIDE_FRAMES); give video slides room to play
  screen: string; // product screen name
  title: string;
  caption: string; // what the screen shows
  say: string; // presenter cue (FR) — "à dire" pendant la démo
};

export const WIDTH = 1920;
export const HEIGHT = 1080;
export const FPS = 30;

export const SLIDE_FRAMES = 6 * FPS;
export const TITLE_FRAMES = 4 * FPS;
export const END_FRAMES = 4 * FPS;

export const THEME = {
  bg: '#0b1220',
  panel: '#111a2e',
  text: '#e5e7eb',
  muted: '#94a3b8',
  accent: '#6366f1',
  accent2: '#10b981',
  border: 'rgba(148,163,184,0.25)',
};

export const BRAND = { top: 'Fraud', bottom: 'Intelligence' };

export const slides: SlideData[] = [
  {
    image: 'architecture.png',
    frames: 9 * FPS,
    screen: 'Architecture',
    title: 'Real deployed architecture',
    caption: 'Rayfin SPA (Fabric-hosted, analyst identity) → Foundry Agent Service (fraud-iq-orchestrator + Web IQ) grounded on Fabric via OBO; server-side traces flow to Application Insights.',
    say: "L'architecture réelle déployée : la SPA Rayfin (identité de l'analyste) appelle en direct l'agent Foundry fraud-iq-orchestrator. Web IQ interroge les sources réglementaires officielles, l'agent est ancré sur Fabric (Data Agent, OBO), et les traces partent dans Application Insights.",
  },
  {
    image: 'dashboard.png',
    screen: 'Dashboard',
    title: 'Fraud Command Center',
    caption: 'KPIs, alerts by fraud type & severity, and the ranked high-risk alerts.',
    say: "On part de la vue d'ensemble : KPI (alertes du jour, exposition estimée, taux de faux positifs) et le top des alertes à risque.",
  },
  {
    image: 'alert-queue.png',
    screen: 'Alert Queue',
    title: "The analyst's entry point",
    caption: 'Open alerts across every fraud type, with risk scoring, severity and status.',
    say: "Le point d'entrée : on filtre la file des alertes ouvertes et on sélectionne un cas à investiguer.",
  },
  {
    image: 'case-detail.png',
    screen: 'Case Detail',
    title: 'Investigate with a grounded agent',
    caption: 'Alert context, customer 360, timeline, evidence panel and an agent chat.',
    say: "On ouvre le cas : contexte, 360 client, timeline, preuves. Le chat agent propose les prochaines actions — décisions escalade/clôture tracées.",
  },
  {
    image: 'fraud-flow.png',
    screen: 'Fraud Flow',
    title: 'Customer 360 event journeys',
    caption: 'A Sankey of pre-fraud events, a geographic event map and an example 360 log.',
    say: "On explore les parcours : le Sankey montre les 5 événements qui précèdent le plus souvent une fraude, avec la carte géographique.",
  },
  {
    image: 'entity-graph.png',
    screen: 'Entity Graph',
    title: 'Typology hubs & AI narrative',
    caption: 'Force-directed graph — red hubs are fraud typologies; centrality-sized nodes.',
    say: "Graphe d'entités : les hubs rouges sont les typologies de fraude ; un clic génère une narration IA du rôle de l'entité et des signaux clés.",
  },
  {
    image: 'aml-copilot.png',
    screen: 'AML Copilot',
    title: 'SAR readiness on Fabric data',
    caption: 'Structured suspicious-activity narrative and the underlying money-movement wires.',
    say: "AML : on génère un récit d'activité suspecte structuré (sujet, typologie, évaluation, recommandation) prêt pour le SAR.",
  },
  {
    image: 'claims-fraud.png',
    screen: 'Claims Fraud',
    title: 'Image-hash reuse & collusion rings',
    caption: 'Perceptual image-hash reuse and repair-provider concentration expose organised rings.',
    say: "Assurance : réutilisation de hash d'images et concentration de prestataires révèlent les réseaux organisés.",
  },
  {
    image: 'fraud-iq.png',
    screen: 'Fraud IQ',
    title: '90 min → 30 sec — the four IQs',
    caption: 'Fabric IQ · Work IQ · Foundry IQ · Web IQ — one agentic prompt, explainable & human-approvable.',
    say: "Le clou : le scénario temps réel 90 min → 30 s. Un seul prompt agentique combine Fabric IQ, Work IQ, Foundry IQ et Web IQ (obligations réglementaires citées).",
  },
  {
    image: 'fraud-iq.png',
    video: 'fraud-iq-run.mp4',
    frames: 10 * FPS,
    screen: 'Fraud IQ · live run',
    title: 'Watch the four IQs resolve',
    caption: 'The agentic scenario runs end to end — Work IQ, Fabric IQ, Foundry IQ & Web IQ reveal in sequence; each column is badged Live or Simulated only once it resolves.',
    say: "En direct : je lance l'investigation agentique. Les colonnes se révèlent une à une — le badge Live/Simulated n'apparaît qu'à la fin de chaque IQ.",
  },
  {
    image: 'fraud-iq.png',
    video: 'fraud-iq-live.mp4',
    placeholder: true,
    frames: 8 * FPS,
    screen: 'Fraud IQ · Foundry live',
    title: 'Foundry IQ — live agent answer',
    caption: 'Placeholder — Scout recording in progress: the real Foundry agent, grounded on Fabric + official regulatory sources, returns a cited, human-approvable answer.',
    say: "(À enregistrer via Scout) La réponse live de l'agent Foundry, ancrée sur Fabric et les sources réglementaires officielles, avec citations et validation humaine.",
  },
  {
    image: 'settings.png',
    screen: 'Settings & Governance',
    title: 'Roles, audit trail & agents',
    caption: 'Role & access matrix (PII / decisions / audit), environment, audit trail, Agents & Web IQ key.',
    say: "Gouvernance : matrice rôles/accès, piste d'audit de chaque run agent, onglet Agents + clé Web IQ. Human-in-the-loop de bout en bout.",
  },
];

export const totalFrames =
  TITLE_FRAMES + slides.reduce((n, s) => n + (s.frames ?? SLIDE_FRAMES), 0) + END_FRAMES;
