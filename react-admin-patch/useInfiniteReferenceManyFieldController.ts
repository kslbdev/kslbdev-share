import { useCallback, useEffect, useRef } from 'react';
import { UseQueryOptions } from '@tanstack/react-query';
import get from 'lodash/get';
import isEqual from 'lodash/isEqual';
import lodashDebounce from 'lodash/debounce';

import {
  useSafeSetState,
  removeEmpty,
  useNotify,
  FilterPayload,
  Identifier,
  RaRecord,
  SortPayload,
  InfiniteListControllerResult,
  usePaginationState,
  useRecordSelection,
  useSortState,
  useResourceContext
} from 'react-admin';
import { useInfiniteGetMany } from './useInfiniteGetMany';

export const useInfiniteReferenceManyFieldController = <
  RecordType extends RaRecord = RaRecord,
  ReferenceRecordType extends RaRecord = RaRecord,
>(
  props: UseInfiniteReferenceManyFieldControllerParams<
    RecordType,
    ReferenceRecordType
  >
): InfiniteListControllerResult<ReferenceRecordType> => {
  const {
    debounce = 500,
    reference,
    record,
    target,
    filter = defaultFilter,
    source = 'id',
    page: initialPage,
    perPage: initialPerPage,
    sort: initialSort = { field: 'id', order: 'DESC' },
    queryOptions = {},
  } = props;
  const notify = useNotify();
  const resource = useResourceContext(props);
  const storeKey = props.storeKey ?? `${resource}.${record?.id}.${reference}`;

  // pagination logic
  const { page, setPage, perPage, setPerPage } = usePaginationState({
    page: initialPage,
    perPage: initialPerPage,
  });

  // sort logic
  const { sort, setSort: setSortState } = useSortState(initialSort);
  const setSort = useCallback(
    (sort: SortPayload) => {
      setSortState(sort);
      setPage(1);
    },
    [setPage, setSortState]
  );

  // selection logic
  const [selectedIds, selectionModifiers] = useRecordSelection({
    resource: storeKey,
  });

  // filter logic
  const filterRef = useRef(filter);
  const [displayedFilters, setDisplayedFilters] = useSafeSetState<{
    [key: string]: boolean;
  }>({});
  const [filterValues, setFilterValues] = useSafeSetState<{
    [key: string]: any;
  }>(filter);

  const hideFilter = useCallback(
    (filterName: string) => {
      setDisplayedFilters(previousState => {
        const { [filterName]: _, ...newState } = previousState;
        return newState;
      });
      setFilterValues(previousState => {
        const { [filterName]: _, ...newState } = previousState;
        return newState;
      });
    },
    [setDisplayedFilters, setFilterValues]
  );

  const showFilter = useCallback(
    (filterName: string, defaultValue: any) => {
      setDisplayedFilters(previousState => ({
        ...previousState,
        [filterName]: true,
      }));
      setFilterValues(previousState => ({
        ...previousState,
        [filterName]: defaultValue,
      }));
    },
    [setDisplayedFilters, setFilterValues]
  );

  const debouncedSetFilters = useCallback(
    lodashDebounce((filters, displayedFilters) => {
      setFilterValues(removeEmpty(filters));
      setDisplayedFilters(displayedFilters);
      setPage(1);
    }, debounce),
    [setDisplayedFilters, setFilterValues, setPage]
  );

  const setFilters = useCallback(
    (
      filters: FilterPayload,
      displayedFilters: { [key: string]: boolean },
      debounce = false
    ) => {
      if (debounce) {
        debouncedSetFilters(filters, displayedFilters);
      } else {
        setFilterValues(removeEmpty(filters));
        setDisplayedFilters(displayedFilters);
        setPage(1);
      }
    },
    [setDisplayedFilters, setFilterValues, setPage, debouncedSetFilters]
  );

  useEffect(() => {
    if (!isEqual(filter, filterRef.current)) {
      filterRef.current = filter;
      setFilterValues(filter);
    }
  });

  const recordId = get(record, source);

  const {
    data,
    total,
    error,
    isLoading,
    isFetching,
    isPending,
    refetch,
    hasNextPage,
    hasPreviousPage,
    fetchNextPage,
    isFetchingNextPage,
    fetchPreviousPage,
    isFetchingPreviousPage,
  } = useInfiniteGetMany<ReferenceRecordType>(
    reference,
    target,
    recordId ?? '',
    {
      pagination: { page, perPage },
      sort,
      filter: {
        ...filterValues,
        [target]: get(record, source),
      },
      meta: queryOptions.meta,
    },
    {
      enabled: get(record, source) != null,
      ...queryOptions,
      onError: error =>
        notify(
          typeof error === 'string'
            ? error
            : error.message || 'ra.notification.http_error',
          {
            type: 'error',
            messageArgs: {
              _:
                typeof error === 'string'
                  ? error
                  : error && error.message
                    ? error.message
                    : undefined,
            },
          }
        ),
    }
  );

  const unwrappedData = data?.pages?.reduce<ReferenceRecordType[]>(
    (acc, page) => [...acc, ...page.data],
    []
  );


  // Create base object with common properties
  const baseProps = {
    sort,
    defaultTitle: undefined,
    displayedFilters,
    filterValues,
    hideFilter,
    isFetching,
    onSelect: selectionModifiers.select,
    onToggleItem: selectionModifiers.toggle,
    onUnselectItems: selectionModifiers.clearSelection,
    page,
    perPage,
    refetch,
    resource: reference,
    selectedIds,
    setFilters,
    setPage,
    setPerPage,
    setSort,
    showFilter,
    hasNextPage,
    hasPreviousPage,
    fetchNextPage,
    isFetchingNextPage,
    fetchPreviousPage,
    isFetchingPreviousPage,
    meta: undefined,
  };

  // If there's an error, return error state
  if (error) {
    return {
      ...baseProps,
      data: undefined,
      error,
      isLoading: false,
      isPending: false as const,
      total: undefined,
    };
  }

  // If loading, return loading state
  if (isPending) {
    return {
      ...baseProps,
      data: undefined,
      error: null,
      isLoading: true,
      isPending: true as const,
      total: undefined,
    };
  }

  return {
    ...baseProps,
    data: unwrappedData ?? [],
    error: null,
    isLoading: false,
    isPending: false as const,
    total: total ?? -1
  };
};

const defaultFilter = {};

export interface UseInfiniteReferenceManyFieldControllerParams<
  RecordType extends Record<string, any> = Record<string, any>,
  ReferenceRecordType extends Record<string, any> = Record<string, any>,
> {
  debounce?: number;
  filter?: FilterPayload;
  page?: number;
  perPage?: number;
  record?: RecordType;
  reference: string;
  resource?: string;
  sort?: SortPayload;
  source?: string;
  storeKey?: string;
  target: string;
  queryOptions?: {
    meta?: any;
    [key: string]: any;
  };
} 