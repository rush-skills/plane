import React from "react";

import Image from "next/image";

import useSWR, { mutate } from "swr";

// services
import projectService from "services/project.service";
// hooks
import { useRouter } from "next/router";
import useToast from "hooks/use-toast";
// components
import { SelectRepository, SelectChannel } from "components/integration";
// icons
import GithubLogo from "public/logos/github-square.png";
import SlackLogo from "public/services/slack.png";
// types
import { IWorkspaceIntegration } from "types";
// fetch-keys
import { PROJECT_GITHUB_REPOSITORY } from "constants/fetch-keys";

type Props = {
  integration: IWorkspaceIntegration;
};

const integrationDetails: { [key: string]: any } = {
  github: {
    logo: GithubLogo,
    description: "Select GitHub repository to enable sync.",
  },
  slack: {
    logo: SlackLogo,
    description:
      "Connect your slack channel to this project to get regular updates. Control which notification you want to receive.",
  },
};

export const SingleIntegration: React.FC<Props> = ({ integration }) => {
  const router = useRouter();
  const { workspaceSlug, projectId } = router.query;

  const { setToastAlert } = useToast();

  const { data: syncedGithubRepository } = useSWR(
    projectId ? PROJECT_GITHUB_REPOSITORY(projectId as string) : null,
    () =>
      workspaceSlug && projectId && integration
        ? projectService.getProjectGithubRepository(
            workspaceSlug as string,
            projectId as string,
            integration.id
          )
        : null
  );

  const handleChange = (repo: any) => {
    if (!workspaceSlug || !projectId || !integration) return;

    const {
      html_url,
      owner: { login },
      id,
      name,
    } = repo;

    projectService
      .syncGithubRepository(workspaceSlug as string, projectId as string, integration.id, {
        name,
        owner: login,
        repository_id: id,
        url: html_url,
      })
      .then(() => {
        mutate(PROJECT_GITHUB_REPOSITORY(projectId as string));

        setToastAlert({
          type: "success",
          title: "Success!",
          message: `${login}/${name} repository synced with the project successfully.`,
        });
      })
      .catch((err) => {
        console.log(err);

        setToastAlert({
          type: "error",
          title: "Error!",
          message: "Repository could not be synced with the project. Please try again.",
        });
      });
  };

  return (
    <>
      {integration && (
        <div className="flex items-center justify-between gap-2 rounded-[10px] border border-custom-border-100 bg-custom-background-100 p-5">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 flex-shrink-0">
              <Image
                src={integrationDetails[integration.integration_detail.provider].logo}
                alt={`${integration.integration_detail.title} Logo`}
              />
            </div>
            <div>
              <h3 className="flex items-center gap-4 text-xl font-semibold">
                {integration.integration_detail.title}
              </h3>
              <p className="text-sm text-custom-text-200">
                {integrationDetails[integration.integration_detail.provider].description}
              </p>
            </div>
          </div>
          {integration.integration_detail.provider === "github" && (
            <SelectRepository
              integration={integration}
              value={
                syncedGithubRepository && syncedGithubRepository.length > 0
                  ? `${syncedGithubRepository[0].repo_detail.owner}/${syncedGithubRepository[0].repo_detail.name}`
                  : null
              }
              label={
                syncedGithubRepository && syncedGithubRepository.length > 0
                  ? `${syncedGithubRepository[0].repo_detail.owner}/${syncedGithubRepository[0].repo_detail.name}`
                  : "Select Repository"
              }
              onChange={handleChange}
            />
          )}
          {integration.integration_detail.provider === "slack" && (
            <SelectChannel integration={integration} />
          )}
        </div>
      )}
    </>
  );
};
