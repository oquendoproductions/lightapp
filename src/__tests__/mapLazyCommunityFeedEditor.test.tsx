import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CommunityFeedEditorController } from "../mapLazyCommunityFeedEditor.jsx";
import { loadCommunityFeedAccessPermissions } from "../lib/mapCommunityFeedAccessSupport";

vi.mock("../lib/mapCommunityFeedAccessSupport", () => ({
  loadCommunityFeedAccessPermissions: vi.fn(),
}));

describe("CommunityFeedEditorController", () => {
  const baseProps = {
    open: true,
    kind: "event",
    mode: "create",
    item: null,
    darkMode: false,
    pageMode: false,
    pageTopInset: "0px",
    pageBottomInset: "0px",
    onClose: vi.fn(),
    supabase: {},
    resolvedCommunityFeedTenantKey: "testcity1",
    sessionUserId: "user-1",
    loadMapCommunityFeed: vi.fn(),
    openNotice: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadCommunityFeedAccessPermissions).mockResolvedValue({
      canManage: true,
      canDelete: true,
    });
  });

  it("preserves the current draft when the topic list refreshes", async () => {
    const initialTopics = [
      { topic_key: "events-general", label: "General Events", topic_kind: "event" },
    ];
    const refreshedTopics = [
      { topic_key: "events-general", label: "General Events", topic_kind: "event" },
      { topic_key: "events-parks", label: "Parks Events", topic_kind: "event" },
    ];

    const { rerender } = render(
      <CommunityFeedEditorController {...baseProps} allTopics={initialTopics} />,
    );

    await waitFor(() => {
      expect(loadCommunityFeedAccessPermissions).toHaveBeenCalled();
    });

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Summer concert" },
    });
    fireEvent.change(screen.getByLabelText("Starts"), {
      target: { value: "2026-08-01T18:30" },
    });
    fireEvent.change(screen.getByLabelText("Ends"), {
      target: { value: "2026-08-01T21:00" },
    });

    rerender(
      <CommunityFeedEditorController {...baseProps} allTopics={refreshedTopics} />,
    );

    expect(screen.getByLabelText("Title")).toHaveValue("Summer concert");
    expect(screen.getByLabelText("Starts")).toHaveValue("2026-08-01T18:30");
    expect(screen.getByLabelText("Ends")).toHaveValue("2026-08-01T21:00");
  });
});
