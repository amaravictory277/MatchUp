export type PersonalizationKey =
  | "selected_name_effect"
  | "selected_profile_frame"
  | "selected_profile_theme"
  | "selected_chat_bubble"
  | "selected_chat_animation"
  | "selected_chat_text"
  | "selected_reaction_style"
  | "selected_match_effect"
  | "selected_tournament_theme"
  | "selected_player_card_theme"
  | "selected_ready_effect"
  | "selected_online_effect"
  | "selected_notification_style";

export type PersonalizationPreferences = Record<PersonalizationKey, string>;

export const DEFAULT_PERSONALIZATION: PersonalizationPreferences = {
  selected_name_effect: "normal",
  selected_profile_frame: "classic",
  selected_profile_theme: "matchup-blue",
  selected_chat_bubble: "matchup-blue",
  selected_chat_animation: "normal",
  selected_chat_text: "normal",
  selected_reaction_style: "normal",
  selected_match_effect: "standard",
  selected_tournament_theme: "matchup-blue",
  selected_player_card_theme: "matchup-blue",
  selected_ready_effect: "standard",
  selected_online_effect: "standard",
  selected_notification_style: "matchup-blue",
};

export type EffectOption = {
  id: string;
  name: string;
  description: string;
  free: true;
  unlocked: true;
  className?: string;
};

export const PERSONALIZATION_CATEGORIES = [
  { key: "name", title: "Name & Text", description: "Style how your MatchUp identity is presented.", icon: "Type", preference: "selected_name_effect" },
  { key: "frame", title: "Profile Frames", description: "Add an original MatchUp frame around your avatar.", icon: "CircleUserRound", preference: "selected_profile_frame" },
  { key: "theme", title: "Profile Theme", description: "Change the atmosphere around your profile.", icon: "Palette", preference: "selected_profile_theme" },
  { key: "chat", title: "Chat Appearance", description: "Customize your outgoing chat bubble and entrance.", icon: "MessageCircle", preference: "selected_chat_bubble" },
  { key: "reaction", title: "Reactions", description: "Choose the visual treatment for your reactions.", icon: "Sparkles", preference: "selected_reaction_style" },
  { key: "match", title: "Match Effects", description: "Choose original MatchUp match presentation effects.", icon: "Swords", preference: "selected_match_effect" },
  { key: "tournament", title: "Tournament Appearance", description: "Choose how tournament presentation is styled.", icon: "Trophy", preference: "selected_tournament_theme" },
  { key: "player", title: "Player Card", description: "Customize your MatchUp Player Card presentation.", icon: "IdCard", preference: "selected_player_card_theme" },
  { key: "ready", title: "Status Effects", description: "Customize Ready and online status cosmetics.", icon: "Zap", preference: "selected_ready_effect" },
  { key: "notification", title: "Notification Style", description: "Choose a cosmetic style for notification surfaces.", icon: "Bell", preference: "selected_notification_style" },
] as const;

export const EFFECTS: Record<string, EffectOption[]> = {
  name: [
    ["normal","Normal","Clean MatchUp text."],["blue-glow","Blue Glow","A restrained blue halo."],["shimmer","Shimmer","A soft light sweeps across the name."],["pulse","Pulse","A gentle breathing emphasis."],["gradient","Gradient","A smooth blue gradient."],["electric","Electric","Subtle blue energy around the text."],["neon","Neon","A refined neon edge."],["gold","Gold","A warm champion highlight."],["ice","Ice","Cool crystalline light."],["fire","Fire","A controlled warm glow."],["wave","Wave","A slow flowing highlight."],["soft-glow","Soft Glow","A quiet luminous finish."],["outline","Outline","A crisp outlined identity."],["champion","Champion","A polished gold-accented finish."],
  ].map(([id,name,description])=>({id,name,description,free:true,unlocked:true})),
  frame: [
    ["classic","Classic MatchUp","Original MatchUp blue frame."],["blue-glow","Blue Glow","Soft blue energy ring."],["electric-blue","Electric Blue","Angular blue energy."],["neon","Neon","Controlled neon edge."],["gold","Gold","Premium-looking gold trim."],["diamond","Diamond","Faceted blue-white frame."],["ice","Ice","Cool crystalline edge."],["fire","Fire","Warm controlled edge."],["stadium","Stadium","Subtle stadium-light treatment."],["football-net","Football Net","Original net-inspired detail."],["championship","Championship","Celebration-style blue and gold."],["dark-elite","Dark Blue Elite","Deep navy elite frame."],["rainbow","Rainbow","A restrained spectrum edge."],["lightning","Lightning","Blue lightning accents."],
  ].map(([id,name,description])=>({id,name,description,free:true,unlocked:true})),
  theme: [
    ["matchup-blue","MatchUp Blue","The standard MatchUp atmosphere."],["stadium-night","Stadium Night","Dark stadium-inspired lighting."],["blue-energy","Blue Energy","Layered blue energy atmosphere."],["football-pitch","Football Pitch","Subtle pitch-inspired texture."],["neon-arena","Neon Arena","Blue arena glow."],["championship","Championship","Celebratory blue/gold atmosphere."],["midnight","Midnight","Deep, quiet navy."],["gold-elite","Gold Elite","Dark blue with restrained gold accents."],["electric","Electric","High-energy blue atmosphere."],["clean-sport","Clean Sport","Minimal sports presentation."],
  ].map(([id,name,description])=>({id,name,description,free:true,unlocked:true})),
  chat: [
    ["matchup-blue","MatchUp Blue","The current MatchUp blue bubble."],["gradient-blue","Gradient Blue","A smooth blue gradient."],["glass","Glass","Subtle translucent sports glass."],["neon","Neon","Blue neon edge."],["dark-elite","Dark Elite","Deep navy outgoing bubble."],["gold","Gold","Restrained gold highlight."],["ice","Ice","Cool light-blue treatment."],["fire","Fire","Controlled warm highlight."],
  ].map(([id,name,description])=>({id,name,description,free:true,unlocked:true})),
  chatText: [
    ["normal","Normal","Clear standard text."],["bold","Bold","Stronger outgoing text."],["soft-glow","Soft Glow","Readable blue text glow."],["blue-gradient","Blue Gradient","Smooth blue text."],["neon","Neon","Light neon edge."],["shimmer","Shimmer","Subtle moving highlight."],["champion","Champion","Refined gold accent."],["ice","Ice","Cool light treatment."],
  ].map(([id,name,description])=>({id,name,description,free:true,unlocked:true})),
  animation: [
    ["normal","Normal","Standard message entrance."],["soft-slide","Soft Slide","Short slide-in."],["fade","Fade","Short fade-in."],["pop","Pop","Small spring-like entrance."],["glow","Glow","Brief blue glow."],["energy","Energy","Brief energy accent."],
  ].map(([id,name,description])=>({id,name,description,free:true,unlocked:true})),
  reaction: [
    ["normal","Normal","Standard reaction behavior."],["blue-pulse","Blue Pulse","Brief MatchUp-blue pulse."],["fire-burst","Fire Burst","Small warm burst."],["lightning","Lightning","Quick blue flash."],["football-kick","Football Kick","Original football motion cue."],["trophy","Trophy","Celebration accent."],["diamond","Diamond","Faceted sparkle."],["ice","Ice","Cool sparkle."],["explosion","Explosion","Small contained burst."],["rocket","Rocket","Quick upward accent."],
  ].map(([id,name,description])=>({id,name,description,free:true,unlocked:true})),
  match: [
    ["standard","Standard MatchUp","Clean original match presentation."],["vs","VS Animation","Short VS energy reveal."],["match-start","Match Start","Blue stadium reveal."],["result","Match Result","Animated score emphasis."],["victory","Victory","Subtle celebration."],["defeat","Defeat","Subtle result transition."],
  ].map(([id,name,description])=>({id,name,description,free:true,unlocked:true})),
  tournament: [
    ["matchup-blue","MatchUp Blue","Standard MatchUp tournament presentation."],["championship","Championship","Celebratory presentation."],["stadium","Stadium","Stadium-inspired atmosphere."],["neon","Neon","Blue neon presentation."],["gold","Gold","Restrained gold highlight."],["electric","Electric","Blue energy presentation."],["midnight","Midnight","Deep navy presentation."],["elite","Elite","Polished dark-blue presentation."],
  ].map(([id,name,description])=>({id,name,description,free:true,unlocked:true})),
  player: [
    ["matchup-blue","MatchUp Blue","Standard MatchUp player card."],["elite","Elite","Dark-blue elite card."],["gold","Gold","Restrained championship highlight."],["neon","Neon","Blue neon card."],["ice","Ice","Cool crystalline card."],["lightning","Lightning","Blue energy card."],["championship","Championship","Celebratory card."],["dark","Dark","Minimal deep-navy card."],
  ].map(([id,name,description])=>({id,name,description,free:true,unlocked:true})),
  ready: [
    ["standard","READY","Standard Ready presentation."],["pulse","Blue Pulse","Blue pulse around READY."],["electric","Electric Ready","Electric blue Ready treatment."],["fire","🔥 READY","Warm Ready accent."],["football","⚽ READY","Football Ready marker."],["trophy","🏆 READY","Trophy Ready marker."],
  ].map(([id,name,description])=>({id,name,description,free:true,unlocked:true})),
  online: [
    ["standard","Standard","Standard online indicator."],["blue-pulse","Blue Pulse","Soft blue pulse."],["electric","Electric","Blue electric indicator."],["fire","Fire","Warm cosmetic indicator."],["diamond","Diamond","Small diamond accent."],["football","Football","Football-inspired indicator."],
  ].map(([id,name,description])=>({id,name,description,free:true,unlocked:true})),
  notification: [
    ["matchup-blue","MatchUp Blue","Standard MatchUp notification styling."],["football","Football","Football accent."],["lightning","Lightning","Blue lightning accent."],["trophy","Trophy","Trophy accent."],["fire","Fire","Warm accent."],["diamond","Diamond","Diamond accent."],
  ].map(([id,name,description])=>({id,name,description,free:true,unlocked:true})),
};
