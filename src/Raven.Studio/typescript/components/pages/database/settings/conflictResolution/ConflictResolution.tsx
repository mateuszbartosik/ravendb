import React, { useEffect } from "react";
import { Button, Card, CardBody, Col, Row } from "reactstrap";
import { AboutViewAnchored, AboutViewHeading, AccordionItemWrapper } from "components/common/AboutView";
import { Icon } from "components/common/Icon";
import { todo } from "common/developmentHelper";
import { useAppDispatch, useAppSelector } from "components/store";
import { NonShardedViewProps } from "components/models/common";
import { accessManagerSelectors } from "components/common/shell/accessManagerSlice";
import { useRavenLink } from "components/hooks/useRavenLink";
import { HrHeader } from "components/common/HrHeader";
import ConflictResolutionConfigPanel from "components/pages/database/settings/conflictResolution/ConflictResolutionConfigPanel";
import { Switch } from "components/common/Checkbox";
import ButtonWithSpinner from "components/common/ButtonWithSpinner";
import { LoadError } from "components/common/LoadError";
import { LazyLoad } from "components/common/LazyLoad";
import { conflictResolutionSelectors, conflictResolutionActions } from "./store/conflictResolutionSlice";
import { EmptySet } from "components/common/EmptySet";

todo("Feature", "Damian", "Add missing logic");
todo("Feature", "Damian", "Connect to Studio");
todo("Feature", "Damian", "Remove legacy code");
todo("Other", "Danielle", "Add Info Hub text");

// TODO report google analitics event

export default function ConflictResolution({ db }: NonShardedViewProps) {
    // To separate file
    const conflictResolutionDocsLink = useRavenLink({ hash: "QRCNKH" });
    const isDatabaseAdmin =
        useAppSelector(accessManagerSelectors.effectiveDatabaseAccessLevel(db.name)) === "DatabaseAdmin";

    const dispatch = useAppDispatch();
    const loadStatus = useAppSelector(conflictResolutionSelectors.loadStatus);
    const config = useAppSelector(conflictResolutionSelectors.config);

    useEffect(() => {
        dispatch(conflictResolutionActions.fetchConfig(db));

        return () => {
            dispatch(conflictResolutionActions.reset());
        };
    }, [db, dispatch]);

    // TODO const save;

    if (loadStatus === "failure") {
        return (
            <LoadError
                error="Unable to load conflict resolution"
                refresh={() => dispatch(conflictResolutionActions.fetchConfig(db))}
            />
        );
    }

    return (
        <Col xxl={12} className="content-margin">
            <Row className="gy-sm">
                <Col>
                    <AboutViewHeading title="Conflict Resolution" icon="conflicts-resolution" />
                    <LazyLoad active={loadStatus === "idle" || loadStatus === "loading"}>
                        {isDatabaseAdmin && (
                            <div id="newConflictResolutionScript" className="d-flex w-fit-content gap-3 mb-3">
                                <ButtonWithSpinner color="primary" icon="save" isSpinning={false}>
                                    Save
                                </ButtonWithSpinner>
                            </div>
                        )}
                        <div className="mb-3">
                            <HrHeader
                                right={
                                    isDatabaseAdmin && (
                                        <div id="addNewScriptButton">
                                            <Button
                                                color="info"
                                                size="sm"
                                                className="rounded-pill"
                                                title="Add a new Conflicts Resolution script"
                                                onClick={() => dispatch(conflictResolutionActions.add())}
                                            >
                                                <Icon icon="plus" />
                                                Add new
                                            </Button>
                                        </div>
                                    )
                                }
                                count={config?.collectionsConfigs?.length}
                            >
                                <Icon icon="documents" />
                                Collection-specific scripts
                            </HrHeader>
                            {config?.collectionsConfigs?.length > 0 ? (
                                _.orderBy(config.collectionsConfigs, ["lastModifiedTime"], ["desc"]).map(
                                    (collectionsConfig) => (
                                        <ConflictResolutionConfigPanel
                                            key={collectionsConfig.name}
                                            isDatabaseAdmin={isDatabaseAdmin}
                                            initialCollectionsConfig={collectionsConfig}
                                        />
                                    )
                                )
                            ) : (
                                <EmptySet>No scripts have been defined</EmptySet>
                            )}
                        </div>
                        <Card>
                            <CardBody>
                                <Switch
                                    color="primary"
                                    selected={config?.isResolveToLatest}
                                    toggleSelection={() =>
                                        dispatch(conflictResolutionActions.toggleIsResolveToLatest())
                                    }
                                    disabled={!isDatabaseAdmin}
                                >
                                    If no script was defined for a collection, resolve the conflict using the latest
                                    version
                                </Switch>
                            </CardBody>
                        </Card>
                    </LazyLoad>
                </Col>
                <Col sm={12} lg={4}>
                    <AboutViewAnchored>
                        <AccordionItemWrapper
                            targetId="1"
                            icon="about"
                            color="info"
                            description="Get additional info on this feature"
                            heading="About this view"
                        >
                            <p>Text for Conflicts Resolution</p>
                            <hr />
                            <div className="small-label mb-2">useful links</div>
                            <a href={conflictResolutionDocsLink} target="_blank">
                                <Icon icon="newtab" /> Docs - Conflict Resolution
                            </a>
                        </AccordionItemWrapper>
                    </AboutViewAnchored>
                </Col>
            </Row>
        </Col>
    );
}
