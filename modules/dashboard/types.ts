import { Prisma } from "@prisma/client";

export type Project = Prisma.PlaygroundGetPayload<{
  include: {
    user: true;
    Starmark: {
      select: {
        isMarked: true;
      };
    };
  };
}>;

export type ProjectUser = Project["user"];
