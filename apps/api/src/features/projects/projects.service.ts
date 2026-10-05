import prisma from "@/utils/db"
import type { DeploymentStatus } from "@forge/types"

export const listAllProjectsService = async (userId: string) => {
  const projects = await prisma.project.findMany({
    where: {
      userId,
    },
    include: {
      deployments: {
        take: 1,
        orderBy: {
          createdAt: "desc",
        },
        select: {
          branch: true,
          status: true,
        },
      },
      githubRepository: {
        select: {
          fullName: true,
          defaultBranch: true,
        },
      },
    },
  })
  const formatedProjects = projects.map((project) => {
    const deployment = project.deployments[0]
    const githubRepository = project.githubRepository || null
    return {
      ...project,
      deployments: {
        branch: deployment?.branch as string,
        status: deployment?.status as DeploymentStatus,
      },
      githubRepository,
    }
  })
  return formatedProjects
}

/**
 * Lightweight project list — just the id and name, for places that only
 * need to link to a project (e.g. the sidebar).
 */
export const listProjectNamesService = async (userId: string) => {
  return prisma.project.findMany({
    where: {
      userId,
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  })
}
