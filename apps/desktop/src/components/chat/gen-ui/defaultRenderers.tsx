import { FileReadDisplay } from '../FileReadDisplay';
import { FileEditDisplay } from '../FileEditDisplay';
import { FileWriteDisplay } from '../FileWriteDisplay';
import { GrepDisplay } from '../GrepDisplay';
import { GlobDisplay } from '../GlobDisplay';
import { WebSearchDisplay } from '../WebSearchDisplay';
import { WebFetchDisplay } from '../WebFetchDisplay';
import { NotebookEditDisplay } from '../NotebookEditDisplay';
import { registerToolRenderer } from './registry';
import { BashToolRenderer } from './BashToolRenderer';

let didRegisterBuiltIns = false;

export function registerDefaultToolRenderers(): void {
  registerToolRenderer('Bash', BashToolRenderer);
  registerToolRenderer('Read', ({ toolCall }) => <FileReadDisplay toolCall={toolCall} />);
  registerToolRenderer('Edit', ({ toolCall }) => <FileEditDisplay toolCall={toolCall} />);
  registerToolRenderer('Write', ({ toolCall }) => <FileWriteDisplay toolCall={toolCall} />);
  registerToolRenderer('Grep', ({ toolCall }) => <GrepDisplay toolCall={toolCall} />);
  registerToolRenderer('Glob', ({ toolCall }) => <GlobDisplay toolCall={toolCall} />);
  registerToolRenderer('WebSearch', ({ toolCall }) => (
    <WebSearchDisplay toolCall={toolCall} />
  ));
  registerToolRenderer('WebFetch', ({ toolCall }) => (
    <WebFetchDisplay toolCall={toolCall} />
  ));
  registerToolRenderer('NotebookEdit', ({ toolCall }) => (
    <NotebookEditDisplay toolCall={toolCall} />
  ));
}

if (!didRegisterBuiltIns) {
  registerDefaultToolRenderers();
  didRegisterBuiltIns = true;
}
