import { Camera, MessageSquareText, Trophy, UserPlus, Video, type LucideIcon } from "lucide-react";
export type FeedTab="for-you"|"following"|"reels";
export type Author={id:string;name:string;handle:string;avatar?:string|null;initials:string};
export type Comment={id:string;author:string;authorId:string;text:string;time:string;isOwn?:boolean};
export type Post={id:string;author:Author;time:string;caption:string;media:string[];videoUrl?:string;hasVideo:boolean;likes:number;comments:number;commentList:Comment[];shares:number;liked:boolean;saved:boolean;following:boolean;isOwn?:boolean;category:"sports"|"community"};
export type FeedAction={id:string;title:string;subtitle:string;icon:LucideIcon;tile:string};
export const feedActions:FeedAction[]=[
 {id:"post-squad",title:"Post squad / gameplay",subtitle:"Share your squad or gameplay with the community.",icon:Camera,tile:"bg-[#0b3154] text-[#70c1ff]"},
 {id:"normal-post",title:"Make Normal Post",subtitle:"Share a quick text update with the community.",icon:MessageSquareText,tile:"bg-[#0b3154] text-[#70c1ff]"},
 {id:"upload-gameplay",title:"Upload gameplay",subtitle:"Share your matches.",icon:Video,tile:"bg-[#0b3154] text-[#70c1ff]"},
 {id:"tournament-win",title:"Share a tournament win",subtitle:"Celebrate your victory.",icon:Trophy,tile:"bg-[#0b3154] text-[#70c1ff]"},
 {id:"goal-highlight",title:"Share a goal/highlight",subtitle:"Show the best moments.",icon:Trophy,tile:"bg-[#0b3154] text-[#70c1ff]"},
 {id:"follow-players",title:"Find other players",subtitle:"Grow your network.",icon:UserPlus,tile:"bg-[#0b3154] text-[#70c1ff]"},
];
let interactionAudioContext:AudioContext|null=null;
export function playInteractionSound(kind:"follow"|"comment"|"post"){if(typeof window==="undefined")return;try{const AudioContextClass=window.AudioContext||(window as Window&{webkitAudioContext?:typeof AudioContext}).webkitAudioContext;if(!AudioContextClass)return;if(!interactionAudioContext||interactionAudioContext.state==="closed")interactionAudioContext=new AudioContextClass();const context=interactionAudioContext;void context.resume();const now=context.currentTime;const oscillator=context.createOscillator();const gain=context.createGain();const pitch=kind==="follow"?620:kind==="comment"?700:560;oscillator.type="sine";oscillator.frequency.setValueAtTime(pitch,now);gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.1,now+.015);gain.gain.exponentialRampToValueAtTime(.0001,now+.16);oscillator.connect(gain).connect(context.destination);oscillator.start(now);oscillator.stop(now+.18);}catch{}}
export function formatCount(value:number){if(value>=1000){const rounded=value/1000;return `${rounded%1===0?rounded.toFixed(0):rounded.toFixed(1)}k`;}return `${value}`;}
