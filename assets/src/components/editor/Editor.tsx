import React, { useMemo, useCallback, useEffect, useState, KeyboardEvent } from 'react';
import { Slate, Editable, withReact, ReactEditor } from 'slate-react';
import { createEditor, Node, Point, Range, Editor as SlateEditor, Transforms, Path } from 'slate';
import { create, Mark, ModelElement, schema, Paragraph, SchemaConfig } from 'data/content/model';
import { editorFor, markFor } from './editors';
import { ToolbarItem, CommandContext } from './interfaces';
import { FixedToolbar, HoveringToolbar } from './Toolbars';
import { onKeyDown as listOnKeyDown } from './editors/Lists';
import { getRootOfText } from './utils';
import { installNormalizer } from './normalizer';
import guid from 'utils/guid';

export type EditorProps = {
  // Callback when there has been any change to the editor (including selection state)
  onEdit: (value: any) => void;

  // The content to display
  value: Node[];

  // The fixed toolbar configuration
  toolbarItems: ToolbarItem[];

  // Whether or not editing is allowed
  editMode: boolean;

  commandContext: CommandContext;
};

// Pressing the Enter key on any void block should insert an empty
// paragraph after that node
const voidOnKeyDown = (editor: ReactEditor, e: KeyboardEvent) => {

  if (e.key === 'Enter') {
    if (editor.selection !== null && Range.isCollapsed(editor.selection)) {

      getRootOfText(editor).lift((node: Node) => {

        const nodeType = node.type as string;
        const schemaItem : SchemaConfig = (schema as any)[nodeType];

        if (schemaItem.isVoid) {
          const path = ReactEditor.findPath(editor, node);
          Transforms.insertNodes(editor, create<Paragraph>(
            { type: 'p', children: [{ text: '' }], id: guid() }),
            { at: Path.next(path) });
        }
      });

    }
  }
};


// Handles exiting a header item via Enter key, setting the next block back to normal (p)
function handleFormattingTermination(editor: SlateEditor, e: KeyboardEvent) {
  if (e.key === 'Enter' && editor.selection !== null && Range.isCollapsed(editor.selection)) {

    const [match] = SlateEditor.nodes(editor, {
      match: n => n.type === 'h1' || n.type === 'h2'
      || n.type === 'h3' || n.type === 'h4'
      || n.type === 'h5' || n.type === 'h6',
    });

    if (match) {
      const [, path] = match;

      const end = SlateEditor.end(editor, path);

      // If the cursor is at the end of the block
      if (Point.equals(editor.selection.focus, end)) {

        const p = create<Paragraph>(
          { type: 'p', children: [{ text: '' }], id: guid() });

        // Insert it ahead of the next node
        const nextMatch = SlateEditor.next(editor, { at: path });
        if (nextMatch) {
          const [, nextPath] = nextMatch;
          Transforms.insertNodes(editor, p, { at: nextPath });

          const newNext = SlateEditor.next(editor, { at: path });
          if (newNext) {
            const [, newPath] = newNext;
            Transforms.select(editor, newPath);
          }


        // But if there is no next node, insert it at end
        } else {
          Transforms.insertNodes(editor, p, { mode: 'highest', at: SlateEditor.end(editor, []) });

          const newNext = SlateEditor.next(editor, { at: path });
          if (newNext) {
            const [, newPath] = newNext;
            Transforms.select(editor, newPath);
          }
        }

        e.preventDefault();
      }
    }
  }
}


function areEqual(prevProps: EditorProps, nextProps: EditorProps) {
  return prevProps.editMode === nextProps.editMode
    && prevProps.toolbarItems === nextProps.toolbarItems
    && prevProps.value === nextProps.value;
}


export const Editor = React.memo((props: EditorProps) => {

  const commandContext = props.commandContext;

  const editor = useMemo(() => withReact(createEditor()), []);
  const [installed, setInstalled] = useState(false);

  // Install the custom normalizer, only once
  useEffect(() => {
    if (!installed) {
      installNormalizer(editor);
      setInstalled(true);
    }
  }, [installed]);

  // Override isVoid to incorporate our schema's opinion on which
  // elements are void
  editor.isVoid = (element) => {
    try {
      const result = (schema as any)[element.type as string].isVoid;
      return result;
    } catch (e) {
      return false;
    }

  };

  editor.isInline = (element) => {
    try {
      const result = (schema as any)[element.type as string].isBlock;
      return !result;
    } catch (e) {
      return false;
    }
  };

  const renderElement = useCallback((props) => {
    const model = props.element as ModelElement;

    return editorFor(model, props, editor, commandContext);
  }, []);

  const onKeyDown = useCallback((e: KeyboardEvent) => {
    voidOnKeyDown(editor, e);
    listOnKeyDown(editor, e);
    handleFormattingTermination(editor, e);
  }, []);

  const renderLeaf = useCallback(({ attributes, children, leaf }: any) => {
    const markup =
      Object
        .keys(leaf)
        .reduce((m, k) => k !== 'text' ? markFor(k as Mark, m) : m, children);
    return <span {...attributes}>{markup}</span>;
  }, []);

  const onChange = (value: Node[]) => {
    const { operations } = editor;

    // Determine if this onChange was due to an actual content change
    if (operations.filter(({ type }) => type !== 'set_selection').length) {
      props.onEdit(value);
    }
  };

  return (
    <div>

      <Slate
        editor={editor as any}
        value={props.value}
        onChange={onChange}
        >
        <FixedToolbar toolbarItems={props.toolbarItems} commandContext={props.commandContext} />

        <HoveringToolbar commandContext={props.commandContext}/>

        <Editable
          readOnly={!props.editMode}
          renderElement={renderElement}
          renderLeaf={renderLeaf}
          placeholder="Enter some content here..."
          onKeyDown={onKeyDown}
        />
      </Slate>
    </div>
  );
}, areEqual);
