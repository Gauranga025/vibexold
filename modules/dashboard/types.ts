import { User, Playground, StarMark, Prisma } from "@prisma/client";

export type ProjectUser = User;

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
