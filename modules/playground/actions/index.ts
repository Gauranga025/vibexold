"use server";

import { db } from "@/lib/db";
import { TemplateFolder } from "../lib/path-to-json";
import { currentUser } from "@/modules/auth/actions";





export const getPlaygroundById = async(id:string)=>{
    const user = await currentUser();
    if (!user || !user.id) {
        return null;
    }

    try {
        const playground = await db.playground.findUnique({
            where:{id},
            select:{
                userId:true,
                title:true,
                templateFiles:{
                    select:{
                        content:true
                    }
                }
            }
        })

        // Verify ownership
        if (!playground || playground.userId !== user.id) {
            return null;
        }

        return playground;
    } catch (error) {
        console.log(error)
        return null;
    }
}

export const SaveUpdatedCode = async(playgroundId:string , data:TemplateFolder)=>{
    const user = await currentUser();
    if (!user || !user.id) return null;

    try {
        // Verify ownership before updating
        const playground = await db.playground.findUnique({
            where: { id: playgroundId },
            select: { userId: true }
        });

        if (!playground || playground.userId !== user.id) {
            return null;
        }

    const updatedPlayground = await db.templateFile.upsert({
        where:{
            playgroundId
        },
        update:{
            content:JSON.stringify(data)
        },
        create:{
            playgroundId,
            content:JSON.stringify(data)
        }
    })

    return updatedPlayground;
  } catch (error) {
     console.log("SaveUpdatedCode error:", error);
    return null;
  }
}