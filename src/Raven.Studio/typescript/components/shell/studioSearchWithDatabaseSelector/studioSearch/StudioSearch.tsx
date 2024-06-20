import "./StudioSearch.scss";
import { OmniSearch } from "common/omniSearch/omniSearch";
import accessManager from "common/shell/accessManager";
import databasesManager from "common/shell/databasesManager";
import generateMenuItems from "common/shell/menu/generateMenuItems";
import intermediateMenuItem from "common/shell/menu/intermediateMenuItem";
import leafMenuItem from "common/shell/menu/leafMenuItem";
import { EmptySet } from "components/common/EmptySet";
import { Icon } from "components/common/Icon";
import { clusterSelectors } from "components/common/shell/clusterSlice";
import { collectionsTrackerSelectors } from "components/common/shell/collectionsTrackerSlice";
import { databaseSelectors } from "components/common/shell/databaseSliceSelectors";
import { useAppUrls } from "components/hooks/useAppUrls";
import useBoolean from "components/hooks/useBoolean";
import { useServices } from "components/hooks/useServices";
import { useAppSelector } from "components/store";
import DatabaseUtils from "components/utils/DatabaseUtils";
import assertUnreachable from "components/utils/assertUnreachable";
import { useAsyncDebounce } from "components/utils/hooks/useAsyncDebounce";
import { RangeTuple } from "fuse.js";
import router from "plugins/router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAsync } from "react-async-hook";
import { Col, Dropdown, DropdownItem, DropdownMenu, DropdownToggle, Input, Row } from "reactstrap";
import IconName from "typings/server/icons";

type SearchItemType =
    | "serverMenuItem"
    | "documentsMenuItem"
    | "indexesMenuItem"
    | "tasksMenuItem"
    | "settingsMenuItem"
    | "statsMenuItem"
    | "collection"
    | "document"
    | "task"
    | "index"
    | "database";

interface SearchResult {
    server: SearchResultItem[];
    database: {
        collections: SearchResultItem[];
        documents: SearchResultItem[];
        indexes: SearchResultItem[];
        tasks: SearchResultItem[];
        settings: SearchResultItem[];
        stats: SearchResultItem[];
    };
    switchToDatabase: SearchResultItem[];
}

type SearchResultDatabaseGroup = keyof SearchResult["database"];

type SearchInnerAction = {
    text: string;
    alternativeTexts?: string[];
};

type SearchItem = {
    id: string;
    type: SearchItemType;
    text: string;
    onSelected: React.MouseEventHandler<HTMLElement>;
    alternativeTexts?: string[];
    route?: string;
    icon?: IconName;
    innerActions?: SearchInnerAction[];
};

type SearchResultItem = {
    id: string;
    type: SearchItemType;
    text: string;
    onSelected: React.MouseEventHandler<HTMLElement>;
    icon?: IconName;
    route?: string;
    indices?: readonly RangeTuple[];
    innerActionText?: string;
    innerActionIndices?: readonly RangeTuple[];
};

type OngoingTaskWithBroker = Raven.Client.Documents.Operations.OngoingTasks.OngoingTask & {
    BrokerType?: Raven.Client.Documents.Operations.ETL.Queue.QueueBrokerType;
};

export default function StudioSearch() {
    const { value: isSearchDropdownOpen, toggle: toggleIsSearchDropdownOpen } = useBoolean(false);

    const [searchQuery, setSearchQuery] = useState("");
    const [results, setResults] = useState<SearchResult>(emptyResult);

    const localNodeTag = useAppSelector(clusterSelectors.localNodeTag);
    const activeDatabase = useAppSelector(databaseSelectors.activeDatabase);
    const activeDatabaseName = useAppSelector(databaseSelectors.activeDatabaseName);
    const allDatabaseNames = useAppSelector(databaseSelectors.allDatabaseNames);
    const collections = useAppSelector(collectionsTrackerSelectors.collections);
    const location = useMemo(
        () => (activeDatabase ? DatabaseUtils.getFirstLocation(activeDatabase, localNodeTag) : null),
        [activeDatabase, localNodeTag]
    );

    const omniSearch = useMemo(() => new OmniSearch<SearchItem, SearchItemType>(), []);
    const menuItems = useMemo(() => generateMenuItems(activeDatabaseName), [activeDatabaseName]);

    const { databasesService, indexesService, tasksService } = useServices();

    useAsync(
        async () => {
            if (!activeDatabaseName) {
                return [];
            }
            return tasksService.getOngoingTasks(activeDatabaseName, location);
        },
        [activeDatabaseName, location],
        {
            onSuccess(results: Raven.Server.Web.System.OngoingTasksResult) {
                const ongoingTasks: SearchItem[] = (results.OngoingTasks as OngoingTaskWithBroker[]).map((x) => ({
                    id: _.uniqueId("task-"),
                    type: "task",
                    icon: "ongoing-tasks",
                    text: x.TaskName,
                    onSelected: (e) => goToTask(x.TaskType, x.BrokerType, x.TaskId, e),
                }));

                const pullReplications: SearchItem[] = results.PullReplications.map((x) => ({
                    id: _.uniqueId("task-"),
                    type: "task",
                    icon: "replication",
                    text: x.Name,
                    onSelected: (e) => goToReplication(x.Mode, x.TaskId, e),
                }));

                omniSearch.register("task", [...ongoingTasks, ...pullReplications]);
            },
        }
    );

    useAsync(
        async () => {
            if (!activeDatabaseName) {
                return [];
            }
            return indexesService.getStats(activeDatabaseName, location);
        },
        [activeDatabaseName, location],
        {
            onSuccess(results) {
                omniSearch.register(
                    "index",
                    results.map((x) => ({
                        id: _.uniqueId("index-"),
                        type: "index",
                        icon: "index",
                        text: x.Name,
                        onSelected: (e) => goToIndex(x.Name, e),
                    }))
                );
            },
        }
    );

    useAsyncDebounce(
        async (searchQuery, activeDatabaseName) => {
            if (!activeDatabaseName || !searchQuery) {
                return [];
            }

            return databasesService.getDocumentsMetadataByIDPrefix(searchQuery, 10, activeDatabaseName);
        },
        [searchQuery, activeDatabaseName],
        500,
        {
            onSuccess: (results) => {
                const mappedResults = results.map((x) => x["@metadata"]["@id"]);

                omniSearch.register(
                    "document",
                    mappedResults.map((result) => ({
                        id: _.uniqueId("document-"),
                        type: "document",
                        icon: "document",
                        text: result,
                        onSelected: (e) => goToDocument(result, e),
                        subText: null,
                    }))
                );
                handleOmniSearch();
            },
        }
    );

    const { appUrl } = useAppUrls();

    const inputRef = useRef<HTMLInputElement>(null);

    const goToUrl = useCallback(
        (url: string, newTab: boolean) => {
            toggleIsSearchDropdownOpen();
            setSearchQuery("");
            if (newTab) {
                window.open(url, "_blank").focus();
            } else {
                router.navigate(url);
            }
        },
        [toggleIsSearchDropdownOpen]
    );

    const goToMenuItem = useCallback(
        (item: leafMenuItem, event: React.MouseEvent<HTMLElement, MouseEvent>) => {
            const url = item.dynamicHash();
            goToUrl(url, event.ctrlKey);
        },
        [goToUrl]
    );

    const goToCollection = useCallback(
        (collectionName: string, event: React.MouseEvent<HTMLElement, MouseEvent>) => {
            const url = appUrl.forDocuments(collectionName, activeDatabaseName);
            goToUrl(url, event.ctrlKey);
        },
        [activeDatabaseName, appUrl, goToUrl]
    );

    const goToDocument = useCallback(
        (documentName: string, event: React.MouseEvent<HTMLElement, MouseEvent>) => {
            const url = appUrl.forEditDoc(documentName, activeDatabaseName);
            goToUrl(url, event.ctrlKey);
        },
        [activeDatabaseName, appUrl, goToUrl]
    );

    const goToIndex = useCallback(
        (indexName: string, event: React.MouseEvent<HTMLElement, MouseEvent>) => {
            const url = appUrl.forEditIndex(indexName, activeDatabaseName);
            goToUrl(url, event.ctrlKey);
        },
        [activeDatabaseName, appUrl, goToUrl]
    );

    const goToTask = useCallback(
        (
            taskType: Raven.Client.Documents.Operations.OngoingTasks.OngoingTaskType,
            brokerType: Raven.Client.Documents.Operations.ETL.Queue.QueueBrokerType,
            taskId: number,
            event: React.MouseEvent<HTMLElement, MouseEvent>
        ) => {
            const getUrlFromProvider = (provider: (db: string, taskId?: number) => string) => {
                return provider(activeDatabaseName, taskId);
            };

            const getUrl = () => {
                switch (taskType) {
                    case "ElasticSearchEtl":
                        return getUrlFromProvider(appUrl.forEditElasticSearchEtl);
                    case "SqlEtl":
                        return getUrlFromProvider(appUrl.forEditSqlEtl);

                    case "RavenEtl":
                        return getUrlFromProvider(appUrl.forEditRavenEtl);

                    case "Subscription":
                        return getUrlFromProvider(appUrl.forEditSubscription);

                    case "Replication":
                        return getUrlFromProvider(appUrl.forEditExternalReplication);

                    case "PullReplicationAsSink":
                        return getUrlFromProvider(appUrl.forEditReplicationSink);

                    case "PullReplicationAsHub":
                        return getUrlFromProvider(appUrl.forEditReplicationHub);

                    case "OlapEtl":
                        return getUrlFromProvider(appUrl.forEditOlapEtl);

                    case "Backup":
                        return appUrl.forEditPeriodicBackupTask("Backups", "OngoingTasks", taskId);

                    case "QueueEtl": {
                        if (brokerType === "Kafka") {
                            return getUrlFromProvider(appUrl.forEditKafkaEtl);
                        } else if (brokerType === "RabbitMq") {
                            return getUrlFromProvider(appUrl.forEditRabbitMqEtl);
                        } else {
                            return null;
                        }
                    }
                    case "QueueSink": {
                        if (brokerType === "Kafka") {
                            return getUrlFromProvider(appUrl.forEditKafkaSink);
                        } else if (brokerType === "RabbitMq") {
                            return getUrlFromProvider(appUrl.forEditRabbitMqSink);
                        } else {
                            return null;
                        }
                    }
                    default:
                        assertUnreachable(taskType);
                }
            };

            goToUrl(getUrl(), event.ctrlKey);
        },
        [activeDatabaseName, appUrl, goToUrl]
    );

    const goToReplication = useCallback(
        (
            replicationMode: Raven.Client.Documents.Operations.Replication.PullReplicationMode,
            id: number,
            event: React.MouseEvent<HTMLElement, MouseEvent>
        ) => {
            let url = null;

            if (replicationMode === "HubToSink") {
                url = appUrl.forEditReplicationHub(activeDatabaseName, id);
            }
            if (replicationMode === "SinkToHub") {
                url = appUrl.forEditReplicationSink(activeDatabaseName, id);
            }

            goToUrl(url, event.ctrlKey);
        },
        [activeDatabaseName, appUrl, goToUrl]
    );

    const handleOmniSearch = () => {
        const searchResults = omniSearch.search(searchQuery);
        const resultTypes = new Set(searchResults.items.map((x) => x.item.type));

        const newResult = { ...emptyResult };

        for (const resultType of resultTypes) {
            const resultsByType = searchResults.items.filter((x) => x.item.type === resultType);

            const items = resultsByType.map((x) => ({
                ...x.item,
                indices: x.indices,
                innerActionText: x.innerActionText,
                innerActionIndices: x.innerActionIndices,
            }));

            switch (resultType) {
                case "document":
                case "documentsMenuItem":
                    newResult.database.documents = items;
                    break;
                case "collection":
                    newResult.database.collections = items;
                    break;
                case "index":
                case "indexesMenuItem":
                    newResult.database.indexes = items;
                    break;
                case "task":
                case "tasksMenuItem":
                    newResult.database.tasks = items;
                    break;
                case "settingsMenuItem":
                    newResult.database.settings = items;
                    break;
                case "statsMenuItem":
                    newResult.database.stats = items;
                    break;
                case "serverMenuItem":
                    newResult.server = items;
                    break;
                case "database":
                    newResult.switchToDatabase = items;
                    break;
                default:
                    assertUnreachable(resultType);
            }
        }

        setResults(newResult);
    };

    useEffect(() => {
        handleOmniSearch();
    }, [searchQuery]);

    // Register collections
    useEffect(() => {
        omniSearch.register(
            "collection",
            collections.map((collection) => ({
                id: _.uniqueId("collection-"),
                type: "collection",
                icon: "documents",
                onSelected: (e) => goToCollection(collection.name, e),
                text: collection.name,
            }))
        );
    }, []);

    // Register databases
    useEffect(() => {
        omniSearch.register(
            "database",
            allDatabaseNames.map((databaseName) => ({
                id: _.uniqueId("database-"),
                type: "database",
                icon: "database",
                onSelected: (e) => {
                    if (e.ctrlKey) {
                        window.open(appUrl.forDocumentsByDatabaseName(null, databaseName));
                    }
                    const db = databasesManager.default.getDatabaseByName(databaseName);
                    databasesManager.default.activate(db);
                },
                text: databaseName,
            }))
        );
    }, [allDatabaseNames]);

    // Register menu items
    useEffect(() => {
        const searchItems: SearchItem[] = [];
        const menuLeafs: leafMenuItem[] = [];

        const crawlMenu = (item: menuItem) => {
            if (item instanceof leafMenuItem) {
                menuLeafs.push(item);
            } else if (item instanceof intermediateMenuItem) {
                item.children.forEach(crawlMenu);
            }
        };

        menuItems.forEach(crawlMenu);

        menuLeafs.forEach((item) => {
            if (ko.unwrap(item.nav) && !item.alias) {
                const canHandle = item.requiredAccess
                    ? accessManager.canHandleOperation(item.requiredAccess, activeDatabaseName)
                    : true;

                if (canHandle) {
                    const firstRoute = (Array.isArray(item.route) ? item.route[0] : item.route) ?? "";
                    const isDatabaseRoute = getIsDatabaseRoute(firstRoute);

                    if (isDatabaseRoute && !activeDatabaseName) {
                        return;
                    }

                    let type: SearchItemType = "serverMenuItem";

                    if (isDatabaseRoute) {
                        if (firstRoute.startsWith("databases/tasks")) {
                            type = "tasksMenuItem";
                        }
                        if (firstRoute.startsWith("databases/indexes")) {
                            type = "indexesMenuItem";
                        }
                        if (firstRoute.startsWith("databases/documents")) {
                            type = "documentsMenuItem";
                        }
                        if (firstRoute.startsWith("databases/settings")) {
                            type = "settingsMenuItem";
                        }
                        if (firstRoute.startsWith("databases/stats")) {
                            type = "statsMenuItem";
                        }
                    }

                    searchItems.push({
                        id: _.uniqueId("menu-item-"),
                        type,
                        text: item.title,
                        route: firstRoute,
                        alternativeTexts: item.search?.alternativeTitles ?? [],
                        icon: item.css.replace("icon-", "") as IconName,
                        onSelected: (e) => goToMenuItem(item, e),
                        innerActions: (item.search?.innerActions ?? []).map((x) => ({
                            text: x.name,
                            alternativeTexts: x.alternativeNames,
                        })),
                    });
                }
            }
        });

        const itemsByType = _.groupBy(searchItems, (x) => x.type);

        // console.log("kalczur itemsByType", itemsByType);

        Object.entries(itemsByType).forEach(([type, items]) => {
            omniSearch.register(type as SearchItemType, items);
        });
    }, [menuItems]);

    const hasServerMatch = results.server.length > 0;
    const hasSwitchToDatabaseMatch = results.switchToDatabase.length > 0;
    const hasDatabaseMatch = Object.keys(results.database).some(
        (groupType: SearchResultDatabaseGroup) => results.database[groupType].length > 0
    );

    return (
        <Dropdown isOpen={isSearchDropdownOpen} toggle={toggleIsSearchDropdownOpen}>
            <DropdownToggle className="d-flex flex-grow-1 p-0">
                <Input
                    innerRef={inputRef}
                    type="search"
                    placeholder="Search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-grow-1"
                />
            </DropdownToggle>
            <DropdownMenu className="studio-search-menu">
                <Row>
                    <Col md={hasServerMatch ? 8 : 12}>
                        <DropdownItem header>Active database</DropdownItem>
                        {hasDatabaseMatch ? (
                            Object.keys(results.database).map((groupType: SearchResultDatabaseGroup) => {
                                const items = results.database[groupType];
                                if (items.length === 0) {
                                    return null;
                                }

                                return (
                                    <React.Fragment key={groupType}>
                                        <DropdownItem header>{groupType}</DropdownItem>
                                        {items.map((item) => (
                                            <ResultItem key={item.id} item={item} />
                                        ))}
                                        <DropdownItem divider />
                                    </React.Fragment>
                                );
                            })
                        ) : (
                            <DropdownItem disabled>
                                <EmptySet>No results found</EmptySet>
                            </DropdownItem>
                        )}

                        {hasSwitchToDatabaseMatch && (
                            <>
                                <DropdownItem header>Switch to database</DropdownItem>
                                {results.switchToDatabase.map((item) => (
                                    <ResultItem key={item.id} item={item} />
                                ))}
                            </>
                        )}
                    </Col>

                    {hasServerMatch && (
                        <Col md={4}>
                            <DropdownItem header>Server</DropdownItem>
                            {results.server.map((item) => (
                                <ResultItem key={item.id} item={item} />
                            ))}
                        </Col>
                    )}
                </Row>
            </DropdownMenu>
        </Dropdown>
    );
}

const emptyResult: SearchResult = {
    server: [],
    database: {
        collections: [],
        documents: [],
        indexes: [],
        tasks: [],
        settings: [],
        stats: [],
    },
    switchToDatabase: [],
};

function getIsDatabaseRoute(route: string): boolean {
    if (route === "databases") {
        return false;
    }
    return route.startsWith("databases");
}

const FuzzyHighlightedText = ({ text, indices }: { text: string; indices: readonly RangeTuple[] }) => {
    const flatMatchedIndices = getFlatFlatMatchedIndexes(indices);

    return (
        <span className="m-0">
            {text.split("").map((char, index) => {
                const isHighlighted = flatMatchedIndices.includes(index);
                if (isHighlighted) {
                    return (
                        <mark key={index} className="p-0">
                            {char}
                        </mark>
                    );
                }
                return char;
            })}
        </span>
    );
};

function getFlatFlatMatchedIndexes(indices: readonly RangeTuple[] | undefined) {
    if (!indices) {
        return [];
    }

    const result: number[] = [];

    indices.forEach((range) => {
        for (let i = range[0]; i <= range[1]; i++) {
            result.push(i);
        }
    });

    return result;
}

interface ResultItemProps {
    item: SearchResultItem;
}

function ResultItem({ item }: ResultItemProps) {
    return (
        <DropdownItem onClick={item.onSelected} className="d-flex align-items-center">
            <Icon icon={item.icon} />
            <div className="lh-1">
                {item.innerActionText ? (
                    <>
                        <FuzzyHighlightedText text={item.innerActionText} indices={item.innerActionIndices} />
                        <br />
                        <span className="fs-6 fw-lighter text-capitalize">{item.route}</span>
                    </>
                ) : (
                    <FuzzyHighlightedText text={item.text} indices={item.indices} />
                )}
            </div>
        </DropdownItem>
    );
}
