import "./StudioSearch.scss";
import classNames from "classnames";
import { OmniSearch } from "common/omniSearch/omniSearch";
import accessManager from "common/shell/accessManager";
import databasesManager from "common/shell/databasesManager";
import generateMenuItems from "common/shell/menu/generateMenuItems";
import intermediateMenuItem from "common/shell/menu/intermediateMenuItem";
import leafMenuItem from "common/shell/menu/leafMenuItem";
import { Icon } from "components/common/Icon";
import { collectionsTrackerSelectors } from "components/common/shell/collectionsTrackerSlice";
import { databaseSelectors } from "components/common/shell/databaseSliceSelectors";
import { useAppUrls } from "components/hooks/useAppUrls";
import useBoolean from "components/hooks/useBoolean";
import { useServices } from "components/hooks/useServices";
import { useAppSelector } from "components/store";
import assertUnreachable from "components/utils/assertUnreachable";
import { useAsyncDebounce } from "components/utils/hooks/useAsyncDebounce";
import { RangeTuple } from "fuse.js";
import router from "plugins/router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Col, Dropdown, DropdownItem, DropdownMenu, DropdownToggle, Input, Row } from "reactstrap";

type SearchItemType =
    | "serverMenuItem"
    | "databaseMenuItem"
    | "collection"
    | "index"
    | "document"
    | "recentDocument"
    | "database";

type SearchInnerAction = {
    text: string;
    alternativeTexts?: string[];
};

type SearchItem = {
    type: SearchItemType;
    icon?: string;
    onSelected: React.MouseEventHandler<HTMLElement>;
    text: string;
    alternativeTexts?: string[];
    innerActions?: SearchInnerAction[];
};

type SearchResultItem = {
    type: SearchItemType;
    icon?: string;
    onSelected: React.MouseEventHandler<HTMLElement>;
    text: string;
    indices?: readonly RangeTuple[];
    innerActionText?: string;
    innerActionIndices?: readonly RangeTuple[];
};

export default function StudioSearch() {
    const { value: isSearchDropdownOpen, toggle: toggleIsSearchDropdownOpen } = useBoolean(false);

    const [searchQuery, setSearchQuery] = useState("");
    const [results, setResults] = useState<Record<SearchItemType, SearchResultItem[]>>({
        serverMenuItem: [],
        databaseMenuItem: [],
        collection: [],
        index: [],
        document: [],
        recentDocument: [],
        database: [],
    });

    const activeDatabaseName = useAppSelector(databaseSelectors.activeDatabaseName);
    const allDatabaseNames = useAppSelector(databaseSelectors.allDatabaseNames);
    const collections = useAppSelector(collectionsTrackerSelectors.collections);

    const omniSearch = useMemo(() => new OmniSearch<SearchItem, SearchItemType>(), []);
    const menuItems = useMemo(() => generateMenuItems(activeDatabaseName), [activeDatabaseName]);

    const { databasesService } = useServices();

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
                        type: "document",
                        icon: "icon-document",
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

    const handleOmniSearch = () => {
        const searchResults = omniSearch.search(searchQuery);

        // console.log("kalczur searchResults", searchResults);

        const groups = _.uniq(searchResults.items.map((x) => x.item.type));

        const newResults: Record<SearchItemType, SearchResultItem[]> = {
            serverMenuItem: [],
            databaseMenuItem: [],
            collection: [],
            index: [],
            document: [],
            recentDocument: [],
            database: [],
        };

        groups.forEach((group) => {
            const resultsByType: SearchResultItem[] = searchResults.items
                .filter((x) => x.item.type === group)
                .map((x) => ({
                    ...x.item,
                    indices: x.indices,
                    innerActionText: x.innerActionText,
                    innerActionIndices: x.innerActionIndices,
                }));
            newResults[group] = resultsByType;
        });
        setResults(newResults);
    };

    useEffect(() => {
        handleOmniSearch();
    }, [searchQuery]);

    // Register collections
    useEffect(() => {
        omniSearch.register(
            "collection",
            collections.map((collection) => ({
                type: "collection",
                icon: "icon-documents",
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
                type: "database",
                icon: "icon-database",
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

        console.log("kalczur menuItems", menuItems);
        console.log("kalczur menuLeafs", menuLeafs);

        menuLeafs.forEach((item) => {
            if (!item.alias) {
                const canHandle = item.requiredAccess
                    ? accessManager.canHandleOperation(item.requiredAccess, activeDatabaseName)
                    : true;

                if (canHandle) {
                    const firstRoute = (Array.isArray(item.route) ? item.route[0] : item.route) ?? "";
                    const isDatabaseRoute = getIsDatabaseRoute(firstRoute);

                    if (isDatabaseRoute && !activeDatabaseName) {
                        // skip this item
                        return;
                    }

                    searchItems.push({
                        type: isDatabaseRoute ? "databaseMenuItem" : "serverMenuItem",
                        text: item.title,
                        alternativeTexts: item.search?.alternativeTitles ?? [],
                        icon: item.css,
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

    const hasServerItemsMatch = results.serverMenuItem.length > 0;
    const hasDatabaseItemsMatch = Object.keys(results)
        .filter((x: SearchItemType) => x !== "serverMenuItem")
        .some((x: SearchItemType) => results[x].length > 0);

    return (
        <>
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
                        {hasDatabaseItemsMatch && (
                            <Col md={hasServerItemsMatch ? 8 : 12}>
                                <DropdownItem header>Active database</DropdownItem>
                                {Object.keys(results)
                                    .filter((x: SearchItemType) => x !== "serverMenuItem")
                                    .map((groupType: SearchItemType) => {
                                        const items = results[groupType];
                                        if (items.length === 0) {
                                            return null;
                                        }

                                        return (
                                            <React.Fragment key={groupType}>
                                                <DropdownItem header>
                                                    <GroupHeader groupType={groupType} />
                                                </DropdownItem>
                                                {items.map((x, idx) => (
                                                    <DropdownItem key={idx} onClick={x.onSelected}>
                                                        <i className={classNames("me-1", x.icon)} />
                                                        <FuzzyHighlightedText text={x.text} indices={x.indices} />
                                                        {x.innerActionText && (
                                                            <span className="small-label m-0">
                                                                <Icon icon="arrow-thin-right" margin="mx-1" />
                                                                <FuzzyHighlightedText
                                                                    text={x.innerActionText}
                                                                    indices={x.innerActionIndices}
                                                                />
                                                            </span>
                                                        )}
                                                    </DropdownItem>
                                                ))}
                                                <DropdownItem divider />
                                            </React.Fragment>
                                        );
                                    })}
                            </Col>
                        )}
                        {hasServerItemsMatch && (
                            <Col md={hasDatabaseItemsMatch ? 4 : 12}>
                                <DropdownItem header>
                                    <GroupHeader groupType="serverMenuItem" />
                                </DropdownItem>
                                {results.serverMenuItem.map((x, idx) => (
                                    <DropdownItem key={idx} onClick={x.onSelected}>
                                        <i className={classNames("me-1", x.icon)} />
                                        <FuzzyHighlightedText text={x.text} indices={x.indices} />
                                        {x.innerActionText && (
                                            <span className="small-label m-0">
                                                <Icon icon="arrow-thin-right" margin="mx-1" />
                                                <FuzzyHighlightedText
                                                    text={x.innerActionText}
                                                    indices={x.innerActionIndices}
                                                />
                                            </span>
                                        )}
                                    </DropdownItem>
                                ))}
                            </Col>
                        )}
                    </Row>
                </DropdownMenu>
            </Dropdown>
        </>
    );
}

function getIsDatabaseRoute(route: string): boolean {
    if (route === "databases") {
        return false;
    }
    return route.startsWith("databases");
}

function GroupHeader({ groupType }: { groupType: SearchItemType }) {
    // TODO add icon with color?

    switch (groupType) {
        case "document":
            return <div>Documents</div>;
        case "collection":
            return <div>Collections</div>;
        case "index":
            return <div>Indexes</div>;
        case "serverMenuItem":
            return <div>Server</div>;
        case "databaseMenuItem":
            return <div>Current Database</div>;
        case "recentDocument":
            return <div>Recent Documents</div>;
        case "database":
            return <div>Switch Active Database</div>;
        default:
            assertUnreachable(groupType);
    }
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
