import { create } from "zustand";
import { toast } from "sonner";

import { TemplateFile, TemplateFolder, TemplateItem } from "../lib/path-to-json";

import { generateFileId, findNodeByPath, rebasePath } from "../lib";

interface OpenFile extends TemplateFile {
  id: string;
  hasUnsavedChanges: boolean;
  content: string;
  originalContent: string;
}

interface FileExplorerState {
  playgroundId: string;
  templateData: TemplateFolder | null;
  openFiles: OpenFile[];
  activeFileId: string | null;
  editorContent: string;

  //   Setter Functions
  setPlaygroundId: (id: string) => void;
  setTemplateData: (data: TemplateFolder | null) => void;
  setEditorContent: (content: string) => void;
  setOpenFiles: (files: OpenFile[]) => void;
  setActiveFileId: (fileId: string | null) => void;

  //   Functions
  openFile: (file: TemplateFile) => void;
  closeFile: (fileId: string) => void;
  closeAllFiles: () => void;

  // File explorer methods
   handleAddFile: (
    newFile: TemplateFile,
    parentPath: string,
    writeFileSync: (filePath: string, content: string) => Promise<void>,
    instance: any,
    saveTemplateData: (data: TemplateFolder) => Promise<void>
  ) => Promise<void>;

  handleAddFolder: (
    newFolder: TemplateFolder, 
    parentPath: string, 
    instance: any, 
    saveTemplateData: (data: TemplateFolder) => Promise<void>
  ) => Promise<void>;

  handleDeleteFile: (
    file: TemplateFile, 
    parentPath: string, 
    saveTemplateData: (data: TemplateFolder) => Promise<void>
  ) => Promise<void>;
  handleDeleteFolder: (
    folder: TemplateFolder,
    parentPath: string,
    saveTemplateData: (data: TemplateFolder) => Promise<void>
  ) => Promise<void>;
  handleRenameFile: (
    file: TemplateFile,
    newFilename: string,
    newExtension: string,
    parentPath: string,
    saveTemplateData: (data: TemplateFolder) => Promise<void>
  ) => Promise<void>;
  handleRenameFolder: (
    folder: TemplateFolder,
    newFolderName: string,
    parentPath: string,
    saveTemplateData: (data: TemplateFolder) => Promise<void>
  ) => Promise<void>;
  
  updateFileContent: (fileId: string, content: string) => void;
}

/**
 * Finds the folder node located at `parentPath` within `root`.
 * `parentPath === ""` means the root folder itself.
 *
 * Throws instead of silently falling back to root: a failed lookup here
 * means the tree is in an inconsistent state (e.g. a node missing its
 * canonical `path`, or a stale/pre-migration tree) and inserting into
 * root anyway would silently corrupt the file structure — exactly the
 * "new folder ends up at root" symptom this is meant to catch.
 */
function resolveParentFolder(root: TemplateFolder, parentPath: string): TemplateFolder {
  if (!parentPath) return root;

  const node = findNodeByPath(root, parentPath);

  if (!node) {
    throw new Error(
      `resolveParentFolder: no node found at path "${parentPath}". ` +
      `This means some node in the current tree does not have the canonical ` +
      `"path" this lookup expected (e.g. loaded from data saved before ` +
      `canonical paths existed). Root items: [${root.items.map(i => `"${i.path}"`).join(", ")}]`
    );
  }

  if (!("items" in node)) {
    throw new Error(
      `resolveParentFolder: node at path "${parentPath}" is a file ("${node.filename}.${node.fileExtension}"), not a folder. ` +
      `Cannot insert into it.`
    );
  }

  return node;
}

// @ts-ignore
export const useFileExplorer = create<FileExplorerState>((set, get) => ({
  templateData: null,
  playgroundId: "",
  openFiles: [] satisfies OpenFile[],
  activeFileId: null,
  editorContent: "",

  setTemplateData: (data) => set({ templateData: data }),
  setPlaygroundId(id) {
    set({ playgroundId: id });
  },
  setEditorContent: (content) => set({ editorContent: content }),
  setOpenFiles: (files) => set({ openFiles: files }),
  setActiveFileId: (fileId) => set({ activeFileId: fileId }),

  openFile: (file) => {
    const fileId = generateFileId(file);
    const { openFiles } = get();
    const existingFile = openFiles.find((f) => f.id === fileId);

    if (existingFile) {
      set({ activeFileId: fileId, editorContent: existingFile.content });
      return;
    }

    const newOpenFile: OpenFile = {
      ...file,
      id: fileId,
      hasUnsavedChanges: false,
      content: file.content || "",
      originalContent: file.content || "",
    };

    set((state) => ({
      openFiles: [...state.openFiles, newOpenFile],
      activeFileId: fileId,
      editorContent: file.content || "",
    }));
  },

  closeFile:(fileId)=>{
    const {openFiles , activeFileId} = get();
     const newFiles = openFiles.filter((f) => f.id !== fileId);

      // If we're closing the active file, switch to another file or clear active
    let newActiveFileId = activeFileId;
    let newEditorContent = get().editorContent;

    if(activeFileId === fileId){
        if(newFiles.length > 0){
              const lastFile = newFiles[newFiles.length - 1];
        newActiveFileId = lastFile.id;
        newEditorContent = lastFile.content;
        }
        else{
            newActiveFileId = null;
            newEditorContent = "";
        }
    }

    set({
        openFiles:newFiles,
        activeFileId:newActiveFileId,
        editorContent:newEditorContent
    })
    
  },
    closeAllFiles: () => {
    set({
      openFiles: [],
      activeFileId: null,
      editorContent: "",
    });
  },

  handleAddFile:async(newFile , parentPath , writeFileSync , instance , saveTemplateData)=>{
        const { templateData } = get();
    if (!templateData) return;

    console.log("[handleAddFile] parentPath =", JSON.stringify(parentPath));

    try {
      const updatedTemplateData = JSON.parse(JSON.stringify(templateData)) as TemplateFolder;
      const currentFolder = resolveParentFolder(updatedTemplateData, parentPath);
      console.log(
        "[handleAddFile] resolvedFolder.path =", JSON.stringify(currentFolder.path),
        " resolvedFolder.folderName =", JSON.stringify(currentFolder.folderName)
      );

      // The caller (file explorer UI) already knows parentPath, so it is
      // expected to have set newFile.path correctly. Fall back to deriving
      // it here defensively in case a caller forgets.
      if (!newFile.path) {
        newFile.path = parentPath
          ? `${parentPath}/${newFile.filename}.${newFile.fileExtension}`
          : `${newFile.filename}.${newFile.fileExtension}`;
      }
      console.log("[handleAddFile] newFile.path =", JSON.stringify(newFile.path));

      currentFolder.items.push(newFile);
      set({ templateData: updatedTemplateData });
      toast.success(`Created file: ${newFile.filename}.${newFile.fileExtension}`);

      // Use the passed saveTemplateData function
      await saveTemplateData(updatedTemplateData);

      // Sync with web container
      if (writeFileSync) {
        await writeFileSync(newFile.path, newFile.content || "");
      }

      get().openFile(newFile);
    } catch (error) {
      console.error("Error adding file:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create file");
    }
  },

    handleAddFolder: async (newFolder, parentPath, instance, saveTemplateData) => {
    const { templateData } = get();
    if (!templateData) return;

    console.log("[handleAddFolder] parentPath =", JSON.stringify(parentPath));
    console.log("[handleAddFolder] newFolder.path (as received) =", JSON.stringify(newFolder.path));

    try {
      const updatedTemplateData = JSON.parse(JSON.stringify(templateData)) as TemplateFolder;
      const currentFolder = resolveParentFolder(updatedTemplateData, parentPath);
      console.log(
        "[handleAddFolder] resolvedFolder.path =", JSON.stringify(currentFolder.path),
        " resolvedFolder.folderName =", JSON.stringify(currentFolder.folderName)
      );

      if (!newFolder.path) {
        newFolder.path = parentPath
          ? `${parentPath}/${newFolder.folderName}`
          : newFolder.folderName;
      }
      console.log("[handleAddFolder] newFolder.path (final) =", JSON.stringify(newFolder.path));

      currentFolder.items.push(newFolder);
      set({ templateData: updatedTemplateData });
      toast.success(`Created folder: ${newFolder.folderName}`);

      // Use the passed saveTemplateData function
      await saveTemplateData(updatedTemplateData);

      // Sync with web container
      if (instance && instance.fs) {
        await instance.fs.mkdir(newFolder.path, { recursive: true });
      }
    } catch (error) {
      console.error("Error adding folder:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create folder");
    }
  },

    handleDeleteFile: async (file, parentPath, saveTemplateData) => {
    const { templateData, openFiles } = get();
    if (!templateData) return;

    try {
      const updatedTemplateData = JSON.parse(
        JSON.stringify(templateData)
      ) as TemplateFolder;
      const currentFolder = resolveParentFolder(updatedTemplateData, parentPath);

      currentFolder.items = currentFolder.items.filter(
        (item) => item.path !== file.path
      );

      // Find and close the file if it's open. The file's own canonical
      // path IS its id, so there's nothing to recompute here.
      const fileId = generateFileId(file);
      const openFile = openFiles.find((f) => f.id === fileId);
      
      if (openFile) {
        // Close the file using the closeFile method
        get().closeFile(fileId);
      }

      set({ templateData: updatedTemplateData });

      // Use the passed saveTemplateData function
      await saveTemplateData(updatedTemplateData);
      toast.success(`Deleted file: ${file.filename}.${file.fileExtension}`);
    } catch (error) {
      console.error("Error deleting file:", error);
      toast.error("Failed to delete file");
    }
  },

    handleDeleteFolder: async (folder, parentPath, saveTemplateData) => {
    const { templateData } = get();
    if (!templateData) return;

    try {
      const updatedTemplateData = JSON.parse(
        JSON.stringify(templateData)
      ) as TemplateFolder;
      const currentFolder = resolveParentFolder(updatedTemplateData, parentPath);

      currentFolder.items = currentFolder.items.filter(
        (item) => item.path !== folder.path
      );

      // Close all files in the deleted folder recursively. Every item
      // already carries its own canonical path, so nothing needs to be
      // reconstructed here.
      const closeFilesInFolder = (node: TemplateItem) => {
        if ("items" in node) {
          node.items.forEach(closeFilesInFolder);
        } else {
          get().closeFile(generateFileId(node));
        }
      };

      closeFilesInFolder(folder);

      set({ templateData: updatedTemplateData });

      // Use the passed saveTemplateData function
      await saveTemplateData(updatedTemplateData);
      toast.success(`Deleted folder: ${folder.folderName}`);
    } catch (error) {
      console.error("Error deleting folder:", error);
      toast.error("Failed to delete folder");
    }
  },

   handleRenameFile: async (
    file,
    newFilename,
    newExtension,
    parentPath,
    saveTemplateData
  ) => {
    const { templateData, openFiles, activeFileId } = get();
    if (!templateData) return;

    const oldFileId = generateFileId(file);
    const newPath = parentPath ? `${parentPath}/${newFilename}.${newExtension}` : `${newFilename}.${newExtension}`;
    const newFileId = newPath;

    try {
      const updatedTemplateData = JSON.parse(
        JSON.stringify(templateData)
      ) as TemplateFolder;
      const currentFolder = resolveParentFolder(updatedTemplateData, parentPath);

      const fileIndex = currentFolder.items.findIndex(
        (item) => item.path === file.path
      );

      if (fileIndex !== -1) {
        const updatedFile = {
          ...currentFolder.items[fileIndex],
          filename: newFilename,
          fileExtension: newExtension,
          path: newPath,
        } as TemplateFile;
        currentFolder.items[fileIndex] = updatedFile;

        // Update open files with new ID and names
        const updatedOpenFiles = openFiles.map((f) =>
          f.id === oldFileId
            ? {
                ...f,
                id: newFileId,
                filename: newFilename,
                fileExtension: newExtension,
                path: newPath,
              }
            : f
        );

        set({
          templateData: updatedTemplateData,
          openFiles: updatedOpenFiles,
          activeFileId: activeFileId === oldFileId ? newFileId : activeFileId,
        });

        // Use the passed saveTemplateData function
        await saveTemplateData(updatedTemplateData);
        toast.success(`Renamed file to: ${newFilename}.${newExtension}`);
      }
    } catch (error) {
      console.error("Error renaming file:", error);
      toast.error("Failed to rename file");
    }
  },

  
  handleRenameFolder: async (folder, newFolderName, parentPath, saveTemplateData) => {
    const { templateData } = get();
    if (!templateData) return;

    try {
      const updatedTemplateData = JSON.parse(
        JSON.stringify(templateData)
      ) as TemplateFolder;
      const currentFolder = resolveParentFolder(updatedTemplateData, parentPath);

      const folderIndex = currentFolder.items.findIndex(
        (item) => item.path === folder.path
      );

      if (folderIndex !== -1) {
        const newPath = parentPath ? `${parentPath}/${newFolderName}` : newFolderName;

        // Renaming a folder changes the canonical path of every file and
        // subfolder beneath it, not just the folder itself — rebasePath
        // recursively rewrites the whole subtree so no descendant is left
        // pointing at a path that no longer exists (which would silently
        // break open tabs, save, and delete for every file inside it).
        const renamedFolder = rebasePath(
          { ...(currentFolder.items[folderIndex] as TemplateFolder), folderName: newFolderName },
          newPath
        );
        currentFolder.items[folderIndex] = renamedFolder;

        set({ templateData: updatedTemplateData });

        // Use the passed saveTemplateData function
        await saveTemplateData(updatedTemplateData);
        toast.success(`Renamed folder to: ${newFolderName}`);
      }
    } catch (error) {
      console.error("Error renaming folder:", error);
      toast.error("Failed to rename folder");
    }
  },

 updateFileContent: (fileId, content) => {
    set((state) => ({
      openFiles: state.openFiles.map((file) =>
        file.id === fileId
          ? {
              ...file,
              content,
              hasUnsavedChanges: content !== file.originalContent,
            }
          : file
      ),
      editorContent:
        fileId === state.activeFileId ? content : state.editorContent,
    }));
  },

}));
