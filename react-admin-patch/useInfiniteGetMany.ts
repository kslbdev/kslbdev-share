import {
    InfiniteData,
    QueryKey,
    useInfiniteQuery,
    UseInfiniteQueryOptions,
    UseInfiniteQueryResult,
    useQueryClient,
} from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import {
    RaRecord,
    GetManyReferenceParams,
    GetInfiniteListResult,
    useDataProvider,
    useEvent,
} from 'react-admin';

const MAX_DATA_LENGTH_TO_CACHE = 100;

/**
 * Call the dataProvider.getManyReference() method and return the resolved result
 * as well as the loading state.
 *
 * @param {string} resource The referenced resource name, e.g. 'posts'
 * @param {string} target The target field name, e.g. 'post_id'
 * @param {string | number} id The identifier of the record to look for
 * @param {Params} params The getManyReference parameters { pagination, sort, filter, meta }
 * @param {Object} options Options object to pass to the queryClient.
 *
 * @returns The current request state. Destructure as { data, total, error, isPending, isSuccess, hasNextPage, fetchNextPage }.
 *
 * @example
 *
 * import { useInfiniteGetMany } from './useInfiniteGetMany';
 *
 * const PostComments = ({ post_id }) => {
 *     const { data, total, isPending, error, hasNextPage, fetchNextPage } = useInfiniteGetMany(
 *         'comments',
 *         'post_id',
 *         post_id,
 *         { 
 *           pagination: { page: 1, perPage: 10 }, 
 *           sort: { field: 'created_at', order: 'DESC' } 
 *         }
 *     );
 *     if (isPending) { return <Loading />; }
 *     if (error) { return <p>ERROR</p>; }
 *     return (
 *         <>
 *             <ul>
 *                 {data?.pages.map(page => {
 *                     return page.data.map(comment => (
 *                         <li key={comment.id}>{comment.body}</li>
 *                     ));
 *                 })}
 *             </ul>
 *             <button 
 *                 disabled={!hasNextPage} 
 *                 onClick={() => fetchNextPage()}
 *             >
 *                 Load more
 *             </button>
 *         </>
 *     );
 * };
 */
export const useInfiniteGetMany = <RecordType extends RaRecord = any>(
    resource: string,
    target: string,
    id: string | number,
    params: Partial<GetManyReferenceParams> = {},
    options: UseInfiniteGetManyOptions<RecordType> = {}
): UseInfiniteGetManyHookValue<RecordType> => {
    const {
        pagination = { page: 1, perPage: 25 },
        sort = { field: 'id', order: 'DESC' },
        filter = {},
        meta,
    } = params;
    const dataProvider = useDataProvider();
    const queryClient = useQueryClient();
    const {
        onSuccess = noop,
        onError = noop,
        onSettled = noop,
        ...queryOptions
    } = options;
    const onSuccessEvent = useEvent(onSuccess);
    const onErrorEvent = useEvent(onError);
    const onSettledEvent = useEvent(onSettled);

    const result = useInfiniteQuery<
        GetInfiniteListResult<RecordType>,
        Error,
        InfiniteData<GetInfiniteListResult<RecordType>>,
        QueryKey,
        number
    >({
        queryKey: [
            resource,
            'getInfiniteMany',
            { id, target, pagination, sort, filter, meta },
        ],
        queryFn: queryParams => {
          console.log('queryParams!!!', queryParams);
            const { pageParam = pagination.page } = queryParams;
            return dataProvider
                .getManyReference<RecordType>(resource, {
                    target,
                    id,
                    pagination: {
                        page: pageParam,
                        perPage: pagination.perPage,
                    },
                    sort,
                    filter,
                    meta,
                })
                .then(({ data, pageInfo, total, meta }) => ({
                    data,
                    total,
                    pageParam,
                    pageInfo,
                    meta,
                }));
        },
        initialPageParam: pagination.page,
        ...queryOptions,
        getNextPageParam: lastLoadedPage => {
          if (lastLoadedPage.pageInfo) {
            return lastLoadedPage.pageInfo.hasNextPage
                ? lastLoadedPage.pageParam + 1
                : undefined;
        }

            const totalPages = Math.ceil(
                (lastLoadedPage.total || 0) / pagination.perPage
            );
            return lastLoadedPage.pageParam < totalPages
                ? Number(lastLoadedPage.pageParam) + 1
                : undefined;
        },
        getPreviousPageParam: lastLoadedPage => {
          if (lastLoadedPage.pageInfo) {
            return lastLoadedPage.pageInfo.hasPreviousPage
                ? lastLoadedPage.pageParam - 1
                : undefined;
        }

            return lastLoadedPage.pageParam === 1
                ? undefined
                : lastLoadedPage.pageParam - 1;
        },
    });

    const metaValue = useRef(meta);
    const resourceValue = useRef(resource);

    useEffect(() => {
        metaValue.current = meta;
    }, [meta]);

    useEffect(() => {
        resourceValue.current = resource;
    }, [resource]);

    useEffect(() => {
        if (
            result.data === undefined ||
            result.error != null ||
            result.isFetching
        )
            return;

        // optimistically populate the getOne cache
        const allPagesDataLength = result.data.pages.reduce(
            (acc, page) => acc + page.data.length,
            0
        );
        if (allPagesDataLength <= MAX_DATA_LENGTH_TO_CACHE) {
            result.data.pages.forEach(page => {
                page.data.forEach(record => {
                    queryClient.setQueryData(
                        [
                            resourceValue.current,
                            'getOne',
                            { id: String(record.id), meta: metaValue.current },
                        ],
                        oldRecord => oldRecord ?? record
                    );
                });
            });
        }

        onSuccessEvent(result.data);
    }, [
        onSuccessEvent,
        queryClient,
        result.data,
        result.error,
        result.isFetching,
    ]);

    useEffect(() => {
        if (result.error == null || result.isFetching) return;
        onErrorEvent(result.error);
    }, [onErrorEvent, result.error, result.isFetching]);

    useEffect(() => {
        if (result.status === 'pending' || result.isFetching) return;
        onSettledEvent(result.data, result.error);
    }, [
        onSettledEvent,
        result.data,
        result.error,
        result.status,
        result.isFetching,
    ]);

    return (
        result.data
            ? {
                  ...result,
                  data: result.data,
                  total: result.data?.pages[0]?.total ?? undefined,
                  meta: result.data?.pages[0]?.meta,
              }
            : result
    ) as UseInfiniteQueryResult<
        InfiniteData<GetInfiniteListResult<RecordType>>,
        Error
    > & {
        total?: number;
        meta?: any
    };
};

const noop = () => undefined;

export type UseInfiniteGetManyOptions<RecordType extends RaRecord = any> = Omit<
    UseInfiniteQueryOptions<
        GetInfiniteListResult<RecordType>,
        Error,
        InfiniteData<GetInfiniteListResult<RecordType>>,
        GetInfiniteListResult<RecordType>,
        QueryKey,
        number
    >,
    | 'queryKey'
    | 'queryFn'
    | 'getNextPageParam'
    | 'getPreviousPageParam'
    | 'initialPageParam'
> & {
    onSuccess?: (data: InfiniteData<GetInfiniteListResult<RecordType>>) => void;
    onError?: (error: Error) => void;
    onSettled?: (
        data?: InfiniteData<GetInfiniteListResult<RecordType>>,
        error?: Error | null
    ) => void;
};

export type UseInfiniteGetManyHookValue<RecordType extends RaRecord = any> =
    UseInfiniteQueryResult<InfiniteData<GetInfiniteListResult<RecordType>>> & {
        total?: number;
        pageParam?: number;
    }; 