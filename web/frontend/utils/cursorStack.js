// Paging state for cursor pagination: the cursor of the shown page (null = first page)
// and the cursors of the pages before it, so "previous" can go back.

export const firstPage = () => ({ cursor: null, previous: [] });

export const nextPage = ({ cursor, previous }, nextCursor) => ({
  cursor: nextCursor,
  previous: [...previous, cursor],
});

export const previousPage = (state) =>
  state.previous.length === 0
    ? state
    : { cursor: state.previous.at(-1), previous: state.previous.slice(0, -1) };

// After deleting the only row of a later page, that page would be empty: go back one.
export const afterDelete = (state, rowsOnPage) =>
  rowsOnPage <= 1 ? previousPage(state) : state;
