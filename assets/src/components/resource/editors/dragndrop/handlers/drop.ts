import { DragPayload, UnknownPayload } from '../interfaces';
import * as Persistence from 'data/persistence/activity';
import { fromPersistence, PageEditorContent } from 'data/editor/PageEditorContent';
import {
  isResourceContent,
  isResourceGroup,
  ResourceContent,
  ResourceGroup,
} from 'data/content/resource';

function adjustIndex(src: number[], dest: number[]) {
  return dest.map((destIndex, level) => {
    const sourceIndex = src[level];
    return sourceIndex < destIndex ? destIndex - 1 : destIndex;
  });
}

export const dropHandler =
  (
    content: PageEditorContent,
    onEditContent: (content: PageEditorContent) => void,
    projectSlug: string,
    onDragEnd: () => void,
    editMode: boolean,
  ) =>
  (e: React.DragEvent<HTMLDivElement>, index: number[]) => {
    onDragEnd();

    if (editMode) {
      const data = e.dataTransfer.getData('application/x-oli-resource-content');

      if (data) {
        const droppedContent = JSON.parse(data) as DragPayload;

        const sourceIndex = content.findIndex((k) => k.id === droppedContent.id);

        if (sourceIndex.length === 0) {
          // This is a cross window drop, we insert it but have to have to
          // ensure that for activities that we create a new activity for
          // tied to this project
          if (droppedContent.type === 'ActivityPayload') {
            if (droppedContent.project !== projectSlug) {
              Persistence.create(
                droppedContent.project,
                droppedContent.activity.typeSlug,
                droppedContent.activity.model,
                [],
              ).then((result: Persistence.Created) => {
                onEditContent(content.insertAt(index, droppedContent.reference));
              });
            } else {
              onEditContent(content.insertAt(index, droppedContent.reference));
            }
          } else if (isResourceContent(droppedContent)) {
            onEditContent(content.insertAt(index, droppedContent as ResourceContent));
          } else {
            onEditContent(content.insertAt(index, (droppedContent as UnknownPayload).data));
          }

          return;
        } else {
          // Handle a same window drag and drop
          const adjustedIndex = adjustIndex(sourceIndex, index);

          let toInsert;
          if (droppedContent.type === 'ActivityPayload') {
            toInsert = droppedContent.reference;
          } else if (isResourceContent(droppedContent)) {
            toInsert = droppedContent as ResourceContent;

            if (isResourceGroup(toInsert)) {
              toInsert = {
                ...toInsert,
                children: fromPersistence((toInsert as any).children),
              } as ResourceGroup;
            }
          } else {
            toInsert = (droppedContent as UnknownPayload).data;
          }

          const reordered = content.delete(droppedContent.id).insertAt(adjustedIndex, toInsert);

          onEditContent(reordered);

          return;
        }
      }

      // Handle a drag and drop from VSCode
      const text = e.dataTransfer.getData('codeeditors');
      if (text) {
        try {
          const json = JSON.parse(text);
          const parsedContent = JSON.parse(json[0].content);

          // Remove it if we find the same identified content item
          const inserted = content
            .delete(parsedContent.id)
            // Then insert it
            .insertAt(index, parsedContent);

          onEditContent(inserted);
        } catch (err) {
          // eslint-disable-next-line
        }
      }
    }
  };
