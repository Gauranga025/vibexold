import { TemplateFile, TemplateFolder, TemplateItem } from "./path-to-json";

/**
 * A file's canonical identity IS its `path` (e.g. "app/dashboard/page.tsx").
 * It is computed once, at scan time (see path-to-json.ts), and carried
 * through the app unchanged from then on — it is never re-derived from
 * filename/fileExtension, since those are not unique across the tree
 * (e.g. "app/page.tsx" and "app/dashboard/page.tsx" both have
 * filename "page" and fileExtension "tsx").
 *
 * This function exists mainly for call-site readability and as a single
 * choke point in case the id format ever needs to diverge from the raw
 * path (e.g. adding a scheme prefix) — it is intentionally a thin wrapper,
 * not a search.
 */
export const generateFileId = (file: TemplateFile): string => file.path;

/**
 * Locates the tree node at a given canonical path. Returns null if no
 * such node exists. Unlike the old name-search approach, this is
 * unambiguous: canonical paths are unique by construction.
 */
export function findNodeByPath(
  root: TemplateFolder,
  targetPath: string
): TemplateItem | null {
  if (root.path === targetPath) return root;

  for (const item of root.items) {
    if (item.path === targetPath) return item;
    if ("items" in item) {
      const found = findNodeByPath(item, targetPath);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Returns a deep copy of `item` with its own `path` set to `newPath`,
 * and every descendant's `path` rewritten to stay consistent with the
 * new location. Used when a folder is renamed or moved: every file and
 * subfolder beneath it has its canonical path recomputed so identities
 * stay correct instead of pointing at a path that no longer exists.
 */
export function rebasePath<T extends TemplateItem>(item: T, newPath: string): T {
  const updated: T = { ...item, path: newPath };

  if ("items" in updated && Array.isArray((updated as unknown as TemplateFolder).items)) {
    const folder = updated as unknown as TemplateFolder;
    folder.items = folder.items.map((child) => {
      const childName = "folderName" in child ? child.folderName : `${child.filename}${child.fileExtension ? "." + child.fileExtension : ""}`;
      const childPath = newPath ? `${newPath}/${childName}` : childName;
      return rebasePath(child, childPath);
    });
  }

  return updated;
}

/**
 * Migrates a template tree that may predate canonical paths so that
 * every node has one.
 *
 * Trees loaded from previously-saved DB content (TemplateFiles.content)
 * can come from before the canonical-path refactor, in which case
 * `path` is missing on every node that wasn't touched since. This walks
 * the tree and fills in any missing `path`, computed the same way the
 * scanner computes it (parentPath + "/" + name), so downstream code
 * (resolveParentFolder, generateFileId, etc.) always has a real path to
 * work with regardless of how old the loaded data is.
 *
 * Nodes that already have a `path` are left completely untouched. If
 * every node already has one, this is a no-op (aside from a shallow
 * copy of the tree). The root folder's path is always normalized to "".
 */
export function upgradeTemplatePaths(root: TemplateFolder): TemplateFolder {
  function upgradeItem(item: TemplateItem, parentPath: string): TemplateItem {
    if ("items" in item) {
      const path =
        item.path != null
          ? item.path
          : parentPath
          ? `${parentPath}/${item.folderName}`
          : item.folderName;
      return {
        ...item,
        path,
        items: item.items.map((child) => upgradeItem(child, path)),
      };
    }

    const path =
      item.path != null
        ? item.path
        : parentPath
        ? `${parentPath}/${item.filename}.${item.fileExtension}`
        : `${item.filename}.${item.fileExtension}`;
    return { ...item, path };
  }

  return {
    ...root,
    path: "",
    items: root.items.map((child) => upgradeItem(child, "")),
  };
}