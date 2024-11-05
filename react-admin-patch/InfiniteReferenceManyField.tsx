import React, { ReactElement, ReactNode } from 'react';
import {
  FieldProps,
  ListContextProvider,
  ResourceContextProvider,
  useRecordContext,
  RaRecord,
  InfinitePaginationContext,
  InfinitePagination,
  ListView,
} from 'react-admin';

import { useInfiniteReferenceManyFieldController, UseInfiniteReferenceManyFieldControllerParams } from './useInfiniteReferenceManyFieldController';

export const InfiniteReferenceManyField = <
  RecordType extends RaRecord = RaRecord,
  ReferenceRecordType extends RaRecord = RaRecord,
>(
  props: ReferenceManyFieldProps<RecordType, ReferenceRecordType>
) => {
  const {
    children,
    debounce,
    filter = defaultFilter,
    page = 1,
    perPage = 25,
    reference,
    resource,
    sort = defaultSort,
    source = 'id',
    storeKey,
    target,
    queryOptions,
  } = props;
  const record = useRecordContext(props);

  const controllerProps = useInfiniteReferenceManyFieldController<
    RecordType,
    ReferenceRecordType
  >({
    debounce,
    filter,
    page,
    perPage,
    record,
    reference,
    resource,
    sort,
    source,
    storeKey,
    target,
    queryOptions,
  });

  return (
    <ResourceContextProvider value={reference}>
      <ListContextProvider value={controllerProps}>
        <InfinitePaginationContext.Provider
          value={{
            hasNextPage: controllerProps.hasNextPage,
            fetchNextPage: controllerProps.fetchNextPage,
            isFetchingNextPage: controllerProps.isFetchingNextPage,
            hasPreviousPage: controllerProps.hasPreviousPage,
            fetchPreviousPage: controllerProps.fetchPreviousPage,
            isFetchingPreviousPage: controllerProps.isFetchingPreviousPage,
          }}
        >
          <ListView<RecordType> {...props} pagination={<InfinitePagination />} />
        </InfinitePaginationContext.Provider>
      </ListContextProvider>
    </ResourceContextProvider>
  );
};

export interface ReferenceManyFieldProps<
  RecordType extends Record<string, any> = Record<string, any>,
  ReferenceRecordType extends Record<string, any> = Record<string, any>,
> extends Omit<FieldProps<RecordType>, 'source'>,
  UseInfiniteReferenceManyFieldControllerParams<RecordType, ReferenceRecordType> {
  children: ReactNode;
}

const defaultFilter = {};
const defaultSort = { field: 'id', order: 'DESC' as const };
