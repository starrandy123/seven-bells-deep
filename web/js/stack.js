// "We give out the tech stack": the panel in the game. It says only what this build really used (S1): a tool goes in once it has made something that shipped.
import { TITLE } from './config.js';

export const STACK_HTML = `
<h2>How ${TITLE} was made</h2>
<p>One person built this game by directing Claude Code on an 8 GB M1 MacBook. Claude wrote the code, the shaders, the moves, the sound and the story, and modelled the world in Blender from scripts. The two human bodies start from Microsoft's open Rocketbox avatars. Here's the whole stack, free for you to copy.</p>
<h3>The stack</h3>
<table>
<tr><td>Director</td><td>Claude Code, working as a lead with a team of builders: movement, combat, world, look, missions and testing</td></tr>
<tr><td>Machine</td><td>One M1 MacBook with 8 GB of memory</td></tr>
<tr><td>Models</td><td>Blender 5.2, run headless from Python scripts, seeded, so every asset can be rebuilt</td></tr>
<tr><td>Rig and moves</td><td>Bones, skinning and every swim and fight clip keyed from Python, exported as glTF</td></tr>
<tr><td>Packing</td><td>gltfpack with meshopt, so a whole hero fits in a couple of megabytes</td></tr>
<tr><td>The game</td><td>three.js r185 on WebGL2, plain JavaScript, no build step, no server</td></tr>
<tr><td>The ocean</td><td>Our own shaders: depth absorption, caustics, sun shafts, Snell's window</td></tr>
<tr><td>Missions</td><td>Data files: every chapter, person, tablet and event is text a builder can change without touching the code</td></tr>
<tr><td>Portraits</td><td>Painted by code, stroke by stroke, in the page</td></tr>
<tr><td>Sound</td><td>Web Audio only, no sound files: water, whales, bells and the score are synthesised live</td></tr>
<tr><td>Hosting</td><td>NotesMosaic, which runs it on web and phones</td></tr>
</table>
<h3>The method</h3>
<p>Write the plan as data first: the bones, the moves, the world's file format. Then let each builder work to that contract. Every requirement gets a check that drives the real game, and a bot has to finish every mission before it counts. Render, look, fix, repeat. Keep a phone's budget from the first hour.</p>
<h3>Build yours</h3>
<p>You can make something like this. Connect your AI to NotesMosaic, tell it what you want, and it can write the game, put it on your phone to play, and publish it when you say so. No build tools to set up and no server to run. A laptop like this one is enough.</p>
<h3>Credits</h3>
<p>three.js (MIT). meshoptimizer and gltfpack (MIT). The Warden's and the Reavers' bodies start from Microsoft Rocketbox avatars (MIT), rebuilt and dressed for this game. Blender was the tool (GPL). NotesMosaic's port kit carries the saves (MIT-0). Everything else in this game was made for it.</p>
`;
