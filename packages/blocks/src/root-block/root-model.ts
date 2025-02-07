import type { Text } from '@blocksuite/store';
import { BlockModel, defineBlockSchema } from '@blocksuite/store';

type RootBlockProps = {
  title: Text;
};

export class RootBlockModel extends BlockModel<RootBlockProps> {
  constructor() {
    super();
    this.created.on(() => {
      this.doc.slots.rootAdded.on(model => {
        if (model instanceof RootBlockModel) {
          const newDocMeta = this.doc.workspace.meta.getDocMeta(model.doc.id);
          if (!newDocMeta || newDocMeta.title !== model.title.toString()) {
            this.doc.workspace.setDocMeta(model.doc.id, {
              title: model.title.toString(),
            });
          }
        }
      });
    });
  }
}

export const RootBlockSchema = defineBlockSchema({
  flavour: 'affine:page',
  props: (internal): RootBlockProps => ({
    title: internal.Text(),
  }),
  metadata: {
    version: 2,
    role: 'root',
  },
  toModel: () => new RootBlockModel(),
});
