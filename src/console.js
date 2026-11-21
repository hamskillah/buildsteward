import { createInterface } from 'node:readline';
import { inspectProject } from './inspect.js';
import { AGENTS, detectAgents, installationDoctor, setupInstallation } from './setup.js';

const menu = [
  '  1  Install or update the skill in this project',
  '  2  Inspect the project',
  '  3  Check skill installation',
  '  4  Command reference',
  '  0  Exit',
].join('\n');

export async function runConsole({ root, input, output, showHelp, detect = detectAgents }) {
  const terminal = createInterface({ input, crlfDelay: Infinity });
  const lines = terminal[Symbol.asyncIterator]();
  const write = text => output.write(text);
  async function ask(prompt) {
    write(prompt);
    const next = await lines.next();
    return next.done ? null : next.value.trim();
  }

  try {
    write(`\nBuildSteward · Project console\nProject: ${root}\n`);
    while (true) {
      const choice = await ask(`\n${menu}\n\nChoose an action › `);
      if (choice === null || choice === '0' || choice === 'exit') return;
      try {
        if (choice === '1') {
          const defaults = (await detect()).join(',');
          const selection = await ask(`Agents (${Object.keys(AGENTS).join(', ')})${defaults ? ` [${defaults}]` : ''}, or cancel: `);
          if (selection === null) return;
          if (selection.toLowerCase() === 'cancel' || (!selection && !defaults)) {
            write('Installation cancelled.\n');
            continue;
          }
          const result = await setupInstallation({ root, agents: selection || defaults });
          write(`Installed for ${result.agents.join(', ')}. Open a fresh agent session and ask it to use BuildSteward.\n`);
        } else if (choice === '2') {
          const project = await inspectProject(root);
          write(`Stack: ${project.stack.join(', ') || 'unknown'}\nFiles found: ${project.markers.join(', ') || 'none'}\n`);
        } else if (choice === '3') {
          const result = await installationDoctor({ root });
          for (const agent of result.agents) {
            write(`  ${agent.agent}: ${agent.healthy ? 'ready' : agent.status}\n`);
          }
          write('This checks local files. Open a fresh agent session to verify activation.\n');
        } else if (choice === '4') {
          showHelp();
        } else {
          write('Choose 0–4.\n');
        }
      } catch (error) {
        write(`Error: ${error.message}\n`);
      }
    }
  } finally {
    terminal.close();
  }
}
