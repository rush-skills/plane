import React, { useCallback, useEffect, useRef, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/router";

import { mutate } from "swr";

// react-beautiful-dnd
import {
  DraggableProvided,
  DraggableStateSnapshot,
  DraggingStyle,
  NotDraggingStyle,
} from "react-beautiful-dnd";
// services
import issuesService from "services/issues.service";
// hooks
import useIssuesView from "hooks/use-issues-view";
import useToast from "hooks/use-toast";
import useOutsideClickDetector from "hooks/use-outside-click-detector";
// components
import {
  ViewAssigneeSelect,
  ViewDueDateSelect,
  ViewEstimateSelect,
  ViewLabelSelect,
  ViewPrioritySelect,
  ViewStateSelect,
} from "components/issues";
// ui
import { ContextMenu, CustomMenu, Tooltip } from "components/ui";
// icons
import {
  ClipboardDocumentCheckIcon,
  LinkIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon,
  ArrowTopRightOnSquareIcon,
  PaperClipIcon,
  EllipsisHorizontalIcon,
} from "@heroicons/react/24/outline";
import { LayerDiagonalIcon } from "components/icons";
// helpers
import { handleIssuesMutation } from "constants/issue";
import { copyTextToClipboard } from "helpers/string.helper";
// types
import {
  ICurrentUserResponse,
  IIssue,
  ISubIssueResponse,
  Properties,
  TIssueGroupByOptions,
  UserAuth,
} from "types";
// fetch-keys
import {
  CYCLE_DETAILS,
  CYCLE_ISSUES_WITH_PARAMS,
  MODULE_DETAILS,
  MODULE_ISSUES_WITH_PARAMS,
  PROJECT_ISSUES_LIST_WITH_PARAMS,
  SUB_ISSUES,
  VIEW_ISSUES,
} from "constants/fetch-keys";

type Props = {
  type?: string;
  provided: DraggableProvided;
  snapshot: DraggableStateSnapshot;
  issue: IIssue;
  properties: Properties;
  groupTitle?: string;
  index: number;
  selectedGroup: TIssueGroupByOptions;
  editIssue: () => void;
  makeIssueCopy: () => void;
  removeIssue?: (() => void) | null;
  handleDeleteIssue: (issue: IIssue) => void;
  handleTrashBox: (isDragging: boolean) => void;
  isCompleted?: boolean;
  user: ICurrentUserResponse | undefined;
  userAuth: UserAuth;
};

export const SingleBoardIssue: React.FC<Props> = ({
  type,
  provided,
  snapshot,
  issue,
  properties,
  index,
  selectedGroup,
  editIssue,
  makeIssueCopy,
  removeIssue,
  groupTitle,
  handleDeleteIssue,
  handleTrashBox,
  isCompleted = false,
  user,
  userAuth,
}) => {
  // context menu
  const [contextMenu, setContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [isMenuActive, setIsMenuActive] = useState(false);

  const actionSectionRef = useRef<HTMLDivElement | null>(null);

  const { orderBy, params } = useIssuesView();

  const router = useRouter();
  const { workspaceSlug, projectId, cycleId, moduleId, viewId } = router.query;

  const { setToastAlert } = useToast();

  const partialUpdateIssue = useCallback(
    (formData: Partial<IIssue>, issue: IIssue) => {
      if (!workspaceSlug || !projectId) return;

      const fetchKey = cycleId
        ? CYCLE_ISSUES_WITH_PARAMS(cycleId.toString(), params)
        : moduleId
        ? MODULE_ISSUES_WITH_PARAMS(moduleId.toString(), params)
        : viewId
        ? VIEW_ISSUES(viewId.toString(), params)
        : PROJECT_ISSUES_LIST_WITH_PARAMS(projectId.toString(), params);

      if (issue.parent) {
        mutate<ISubIssueResponse>(
          SUB_ISSUES(issue.parent.toString()),
          (prevData) => {
            if (!prevData) return prevData;

            return {
              ...prevData,
              sub_issues: (prevData.sub_issues ?? []).map((i) => {
                if (i.id === issue.id) {
                  return {
                    ...i,
                    ...formData,
                  };
                }
                return i;
              }),
            };
          },
          false
        );
      } else {
        mutate<
          | {
              [key: string]: IIssue[];
            }
          | IIssue[]
        >(
          fetchKey,
          (prevData) =>
            handleIssuesMutation(
              formData,
              groupTitle ?? "",
              selectedGroup,
              index,
              orderBy,
              prevData
            ),
          false
        );
      }

      issuesService
        .patchIssue(workspaceSlug as string, projectId as string, issue.id, formData, user)
        .then(() => {
          mutate(fetchKey);

          if (cycleId) mutate(CYCLE_DETAILS(cycleId as string));
          if (moduleId) mutate(MODULE_DETAILS(moduleId as string));
        });
    },
    [
      workspaceSlug,
      projectId,
      cycleId,
      moduleId,
      viewId,
      groupTitle,
      index,
      selectedGroup,
      orderBy,
      params,
      user,
    ]
  );

  const getStyle = (
    style: DraggingStyle | NotDraggingStyle | undefined,
    snapshot: DraggableStateSnapshot
  ) => {
    if (orderBy === "sort_order") return style;
    if (!snapshot.isDragging) return {};
    if (!snapshot.isDropAnimating) return style;

    return {
      ...style,
      transitionDuration: `0.001s`,
    };
  };

  const handleCopyText = () => {
    const originURL =
      typeof window !== "undefined" && window.location.origin ? window.location.origin : "";
    copyTextToClipboard(
      `${originURL}/${workspaceSlug}/projects/${projectId}/issues/${issue.id}`
    ).then(() => {
      setToastAlert({
        type: "success",
        title: "Link Copied!",
        message: "Issue link copied to clipboard.",
      });
      setIsMenuActive(false);
    });
  };

  useEffect(() => {
    if (snapshot.isDragging) handleTrashBox(snapshot.isDragging);
  }, [snapshot, handleTrashBox]);

  useOutsideClickDetector(actionSectionRef, () => setIsMenuActive(false));

  const isNotAllowed = userAuth.isGuest || userAuth.isViewer || isCompleted;

  return (
    <>
      <ContextMenu
        position={contextMenuPosition}
        title="Quick actions"
        isOpen={contextMenu}
        setIsOpen={setContextMenu}
      >
        {!isNotAllowed && (
          <>
            <ContextMenu.Item Icon={PencilIcon} onClick={editIssue}>
              Edit issue
            </ContextMenu.Item>
            <ContextMenu.Item Icon={ClipboardDocumentCheckIcon} onClick={makeIssueCopy}>
              Make a copy...
            </ContextMenu.Item>
            <ContextMenu.Item Icon={TrashIcon} onClick={() => handleDeleteIssue(issue)}>
              Delete issue
            </ContextMenu.Item>
          </>
        )}
        <ContextMenu.Item Icon={LinkIcon} onClick={handleCopyText}>
          Copy issue link
        </ContextMenu.Item>
        <a
          href={`/${workspaceSlug}/projects/${projectId}/issues/${issue.id}`}
          target="_blank"
          rel="noreferrer noopener"
        >
          <ContextMenu.Item Icon={ArrowTopRightOnSquareIcon}>
            Open issue in new tab
          </ContextMenu.Item>
        </a>
      </ContextMenu>
      <div
        className={`mb-3 rounded bg-custom-background-90 shadow ${
          snapshot.isDragging ? "border-2 border-custom-primary shadow-lg" : ""
        }`}
        ref={provided.innerRef}
        {...provided.draggableProps}
        {...provided.dragHandleProps}
        style={getStyle(provided.draggableProps.style, snapshot)}
        onContextMenu={(e) => {
          e.preventDefault();
          setContextMenu(true);
          setContextMenuPosition({ x: e.pageX, y: e.pageY });
        }}
      >
        <div className="group/card relative select-none p-3.5">
          {!isNotAllowed && (
            <div
              ref={actionSectionRef}
              className={`z-1 absolute top-1.5 right-1.5 hidden group-hover/card:!flex ${
                isMenuActive ? "!flex" : ""
              }`}
            >
              {type && !isNotAllowed && (
                <CustomMenu
                  customButton={
                    <button
                      className="flex w-full cursor-pointer items-center justify-between gap-1 rounded p-1 text-left text-xs duration-300 hover:bg-custom-background-80"
                      onClick={() => setIsMenuActive(!isMenuActive)}
                    >
                      <EllipsisHorizontalIcon className="h-4 w-4" />
                    </button>
                  }
                >
                  <CustomMenu.MenuItem onClick={editIssue}>
                    <div className="flex items-center justify-start gap-2">
                      <PencilIcon className="h-4 w-4" />
                      <span>Edit issue</span>
                    </div>
                  </CustomMenu.MenuItem>
                  {type !== "issue" && removeIssue && (
                    <CustomMenu.MenuItem onClick={removeIssue}>
                      <div className="flex items-center justify-start gap-2">
                        <XMarkIcon className="h-4 w-4" />
                        <span>Remove from {type}</span>
                      </div>
                    </CustomMenu.MenuItem>
                  )}
                  <CustomMenu.MenuItem onClick={() => handleDeleteIssue(issue)}>
                    <div className="flex items-center justify-start gap-2">
                      <TrashIcon className="h-4 w-4" />
                      <span>Delete issue</span>
                    </div>
                  </CustomMenu.MenuItem>
                  <CustomMenu.MenuItem onClick={handleCopyText}>
                    <div className="flex items-center justify-start gap-2">
                      <LinkIcon className="h-4 w-4" />
                      <span>Copy issue Link</span>
                    </div>
                  </CustomMenu.MenuItem>
                </CustomMenu>
              )}
            </div>
          )}
          <Link href={`/${workspaceSlug}/projects/${issue.project}/issues/${issue.id}`}>
            <a>
              {properties.key && (
                <div className="mb-2.5 text-xs font-medium text-custom-text-200">
                  {issue.project_detail.identifier}-{issue.sequence_id}
                </div>
              )}
              <h5 className="text-sm break-words line-clamp-3">{issue.name}</h5>
            </a>
          </Link>
          <div className="relative mt-2.5 flex flex-wrap items-center gap-2 text-xs">
            {properties.priority && (
              <ViewPrioritySelect
                issue={issue}
                partialUpdateIssue={partialUpdateIssue}
                isNotAllowed={isNotAllowed}
                user={user}
                selfPositioned
              />
            )}
            {properties.state && (
              <ViewStateSelect
                issue={issue}
                partialUpdateIssue={partialUpdateIssue}
                isNotAllowed={isNotAllowed}
                user={user}
                selfPositioned
              />
            )}
            {properties.due_date && (
              <ViewDueDateSelect
                issue={issue}
                partialUpdateIssue={partialUpdateIssue}
                user={user}
                isNotAllowed={isNotAllowed}
              />
            )}
            {properties.labels && (
              <ViewLabelSelect
                issue={issue}
                partialUpdateIssue={partialUpdateIssue}
                isNotAllowed={isNotAllowed}
                user={user}
                selfPositioned
              />
            )}
            {properties.assignee && (
              <ViewAssigneeSelect
                issue={issue}
                partialUpdateIssue={partialUpdateIssue}
                isNotAllowed={isNotAllowed}
                user={user}
                selfPositioned
              />
            )}
            {properties.estimate && (
              <ViewEstimateSelect
                issue={issue}
                partialUpdateIssue={partialUpdateIssue}
                isNotAllowed={isNotAllowed}
                user={user}
                selfPositioned
              />
            )}
            {properties.sub_issue_count && (
              <div className="flex cursor-default items-center rounded-md border border-custom-border-100 px-2.5 py-1 text-xs shadow-sm">
                <Tooltip tooltipHeading="Sub-issue" tooltipContent={`${issue.sub_issues_count}`}>
                  <div className="flex items-center gap-1 text-custom-text-200">
                    <LayerDiagonalIcon className="h-3.5 w-3.5" />
                    {issue.sub_issues_count}
                  </div>
                </Tooltip>
              </div>
            )}
            {properties.link && (
              <div className="flex cursor-default items-center rounded-md border border-custom-border-100 px-2.5 py-1 text-xs shadow-sm">
                <Tooltip tooltipHeading="Link" tooltipContent={`${issue.link_count}`}>
                  <div className="flex items-center gap-1 text-custom-text-200">
                    <LinkIcon className="h-3.5 w-3.5" />
                    {issue.link_count}
                  </div>
                </Tooltip>
              </div>
            )}
            {properties.attachment_count && (
              <div className="flex cursor-default items-center rounded-md border border-custom-border-100 px-2.5 py-1 text-xs shadow-sm">
                <Tooltip tooltipHeading="Attachment" tooltipContent={`${issue.attachment_count}`}>
                  <div className="flex items-center gap-1 text-custom-text-200">
                    <PaperClipIcon className="h-3.5 w-3.5 -rotate-45" />
                    {issue.attachment_count}
                  </div>
                </Tooltip>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
