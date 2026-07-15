"use server";

import { db } from "@/lib/db";
import { currentUser } from "@/modules/auth/actions";
import { revalidatePath } from "next/cache";
import { Project } from "../types";

export const toggleStarMarked = async (
  playgroundId: string,
  isChecked: boolean
) => {
  const user = await currentUser();
  const userId = user?.id;
  if (!userId) {
    throw new Error("User Id is Required");
  }

  try {
    // Verify playground ownership
    const playground = await db.playground.findUnique({
      where: { id: playgroundId },
      select: { userId: true }
    });

    if (!playground || playground.userId !== userId) {
      return { success: false, error: "Playground not found or access denied" };
    }

    if (isChecked) {
      await db.starMark.create({
        data: {
          userId: userId,
          playgroundId,
          isMarked: isChecked,
        },
      });
    } else {
        await db.starMark.delete({
        where: {
          userId_playgroundId: {
            userId,
            playgroundId: playgroundId,

          },
        },
      });
    }

     revalidatePath("/dashboard");
    return { success: true, isMarked: isChecked };
  } catch (error) {
       console.error("Error updating problem:", error);
    return { success: false, error: "Failed to update problem" };
  }
};

export const getAllPlaygroundForUser = async (): Promise<Project[]> => {
  const user = await currentUser();

  if (!user || !user.id) {
    return [];
  }

  try {
    const playground = await db.playground.findMany({
      where: {
        userId: user.id,
      },
      include: {
        user: true,
        Starmark:{
            where:{
                userId: user.id
            },
            select:{
                isMarked:true
            }
        }
      },
    });

    return playground as Project[];
  } catch (error) {
    console.log(error);
    return [];
  }
};

export const createPlayground = async (data: {
  title: string;
  template: "REACT" | "NEXTJS" | "EXPRESS" | "VUE" | "HONO" | "ANGULAR";
  description?: string;
}) => {
  const user = await currentUser();

  if (!user || !user.id) {
    return null;
  }

  const { template, title, description } = data;

  try {
    const playground = await db.playground.create({
      data: {
        title: title,
        description: description,
        template: template,
        userId: user.id,
      },
    });

    return playground;
  } catch (error) {
    console.error("Failed to create playground:", error);
    return null;
  }
};

export const deleteProjectById = async (id: string) => {
  const user = await currentUser();
  if (!user || !user.id) {
    throw new Error("User not authenticated");
  }

  try {
    // Verify ownership before deleting
    const playground = await db.playground.findUnique({
      where: { id },
      select: { userId: true }
    });

    if (!playground || playground.userId !== user.id) {
      throw new Error("Playground not found or access denied");
    }

    await db.playground.delete({
      where: {
        id,
      },
    });
    revalidatePath("/dashboard");
  } catch (error) {
    console.log(error);
    throw error;
  }
};

export const editProjectById = async (
  id: string,
  data: { title: string; description: string }
) => {
  const user = await currentUser();
  if (!user || !user.id) {
    throw new Error("User not authenticated");
  }

  try {
    // Verify ownership before editing
    const playground = await db.playground.findUnique({
      where: { id },
      select: { userId: true }
    });

    if (!playground || playground.userId !== user.id) {
      throw new Error("Playground not found or access denied");
    }

    await db.playground.update({
      where: {
        id,
      },
      data: data,
    });
    revalidatePath("/dashboard");
  } catch (error) {
    console.log(error);
    throw error;
  }
};

export const duplicateProjectById = async (id: string) => {
  const user = await currentUser();
  if (!user || !user.id) {
    throw new Error("User not authenticated");
  }

  try {
    const originalPlayground = await db.playground.findUnique({
      where: { id },
      include: {
        templateFiles: true
      }
    });
    if (!originalPlayground) {
      throw new Error("Original playground not found");
    }

    // Verify ownership before duplicating
    if (originalPlayground.userId !== user.id) {
      throw new Error("Playground not found or access denied");
    }

    const duplicatedPlayground = await db.playground.create({
      data: {
        title: `${originalPlayground.title} (Copy)`,
        description: originalPlayground.description,
        template: originalPlayground.template,
        userId: user.id,
      },
    });

    // Copy template files if they exist
    if (originalPlayground.templateFiles && originalPlayground.templateFiles.length > 0) {
      await db.templateFile.create({
        data: {
          content: originalPlayground.templateFiles[0].content as any,
          playgroundId: duplicatedPlayground.id,
        },
      });
    }

    revalidatePath("/dashboard");
    return duplicatedPlayground;
  } catch (error) {
    console.error("Error duplicating project:", error);
    throw error;
  }
};