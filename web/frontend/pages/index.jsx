import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { useAppBridge } from "@shopify/app-bridge-react";
import { deleteTimer, listTimers, updateTimer } from "../api/timers";
import { DeleteTimerModal, ListMessage, TimerFilters, TimerTable } from "../components";
import { afterDelete, firstPage, nextPage, previousPage } from "../utils/cursorStack";
import { listView, shouldRetry } from "../utils/listView";

const SEARCH_DEBOUNCE_MS = 300;

export default function HomePage() {
  const shopify = useAppBridge();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("oldest");
  const [page, setPage] = useState(firstPage);
  const [deleting, setDeleting] = useState(null);
  const modalRef = useRef(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const trimmed = search.trim();
      if (trimmed !== q) {
        setQ(trimmed);
        setPage(firstPage());
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [search, q]);

  const toast = (message, isError = false) => shopify.toast.show(message, { isError });

  // Each param set has its own cache entry, so a slow older response never replaces the current page.
  const params = { sort, q, cursor: page.cursor };
  const list = useQuery(["timers", params], ({ signal }) => listTimers(params, { signal }), {
    keepPreviousData: true,
    retry: shouldRetry,
    onError: () => {
      // With nothing cached the error card shows instead.
      if (queryClient.getQueryData(["timers", params])) toast("Timers could not be refreshed", true);
    },
  });
  const timers = list.data?.data ?? [];
  const nextCursor = list.data?.meta?.pagination?.nextCursor ?? null;

  const refetch = () => queryClient.invalidateQueries("timers");

  const toggle = useMutation(({ id, enabled }) => updateTimer(id, { enabled }), {
    onSuccess: (_result, { enabled }) => toast(enabled ? "Timer enabled" : "Timer disabled"),
    onError: (error) => toast(error.message || "Timer could not be updated", true),
    onSettled: refetch,
  });
  const remove = useMutation((timer) => deleteTimer(timer.id), {
    onSuccess: () => {
      modalRef.current?.hideOverlay();
      toast("Timer deleted");
      setPage((current) => afterDelete(current, timers.length));
    },
    // The modal stays open so the merchant can retry or cancel.
    onError: (error) => toast(error.message || "Timer could not be deleted", true),
    onSettled: refetch,
  });
  const busy = toggle.isLoading || remove.isLoading;

  const clearSearch = () => {
    setSearch("");
    setQ("");
    setPage(firstPage());
  };

  const view = listView({
    isLoading: list.isLoading,
    isError: list.isError,
    hasData: Boolean(list.data),
    isPreviousData: list.isPreviousData,
    count: timers.length,
    q,
    onFirstPage: page.previous.length === 0,
  });
  const spinner = (
    <s-stack alignItems="center" padding="large">
      <s-spinner accessibilityLabel="Loading timers" size="large"></s-spinner>
    </s-stack>
  );

  let content;
  if (view === "loading") {
    content = <s-section>{spinner}</s-section>;
  } else if (view === "error") {
    content = (
      <ListMessage heading="Timers could not be loaded" text="Check your connection and try again.">
        <s-button loading={list.isFetching || undefined} onClick={() => list.refetch()}>
          Retry
        </s-button>
      </ListMessage>
    );
  } else if (view === "first") {
    content = (
      <ListMessage heading="Create your first timer" text="Show shoppers a countdown on your product pages.">
        {/* Create arrives with the form in plan 06. */}
        <s-button variant="primary" icon="plus" disabled>
          Create timer
        </s-button>
      </ListMessage>
    );
  } else {
    content = (
      <s-section padding="none">
        <s-box padding="base">
          <TimerFilters
            search={search}
            sort={sort}
            onSearchChange={setSearch}
            onSortChange={(value) => {
              setSort(value);
              setPage(firstPage());
            }}
          />
        </s-box>
        {view === "pending" ? (
          spinner
        ) : view === "noMatch" ? (
          <ListMessage heading={`No timers match "${q}"`} text="Try another name.">
            <s-button onClick={clearSearch}>Clear search</s-button>
          </ListMessage>
        ) : (
          <TimerTable
            timers={timers}
            loading={list.isFetching}
            hasNext={Boolean(nextCursor)}
            hasPrevious={page.previous.length > 0}
            busy={busy}
            onNext={() => nextCursor && setPage((current) => nextPage(current, nextCursor))}
            onPrevious={() => setPage(previousPage)}
            onToggle={(timer) => !busy && toggle.mutate({ id: timer.id, enabled: !timer.enabled })}
            onDelete={(timer) => {
              setDeleting(timer);
              modalRef.current?.showOverlay();
            }}
          />
        )}
      </s-section>
    );
  }

  return (
    <s-page heading="Countdown Timer Manager">
      <s-button slot="primary-action" variant="primary" icon="plus" disabled>
        Create timer
      </s-button>
      <s-paragraph color="subdued">Create and manage countdown timers for your promotions.</s-paragraph>
      {content}
      <DeleteTimerModal
        modalRef={modalRef}
        timer={deleting}
        busy={remove.isLoading}
        onConfirm={() => deleting && !remove.isLoading && remove.mutate(deleting)}
        onHidden={() => setDeleting(null)}
      />
    </s-page>
  );
}
