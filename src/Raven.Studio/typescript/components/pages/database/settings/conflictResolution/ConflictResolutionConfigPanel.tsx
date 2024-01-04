import React, { useState } from "react";
import {
    RichPanel,
    RichPanelHeader,
    RichPanelInfo,
    RichPanelName,
    RichPanelActions,
    RichPanelDetails,
    RichPanelDetailItem,
} from "components/common/RichPanel";
import { Button, Collapse, InputGroup, Label, UncontrolledTooltip } from "reactstrap";
import { Icon } from "components/common/Icon";
import { EditConflictResolutionSyntaxModal } from "components/pages/database/settings/conflictResolution/EditConflictResolutionSyntaxModal";
import { useAppDispatch, useAppSelector } from "components/store";
import { collectionsTrackerSelectors } from "components/common/shell/collectionsTrackerSlice";
import { SelectOption } from "components/common/select/Select";
import useBoolean from "hooks/useBoolean";
import useId from "hooks/useId";
import SelectCreatable from "components/common/select/SelectCreatable";
import AceEditor from "components/common/AceEditor";
import genUtils from "common/generalUtils";
import { ConflictResolutionCollectionConfig, conflictResolutionActions } from "./store/conflictResolutionSlice";

interface ConflictResolutionConfigPanelProps {
    isDatabaseAdmin: boolean;
    initialCollectionsConfig: ConflictResolutionCollectionConfig;
}

export default function ConflictResolutionConfigPanel({
    isDatabaseAdmin,
    initialCollectionsConfig,
}: ConflictResolutionConfigPanelProps) {
    const allCollectionNames = useAppSelector(collectionsTrackerSelectors.collectionNames).filter(
        (x) => x !== "@empty" && x !== "@hilo"
    );

    // TODO use form? and validate if select is not on list

    const dispatch = useAppDispatch();
    const [collection, setCollection] = useState(initialCollectionsConfig.name);
    const [script, setScript] = useState(initialCollectionsConfig.script);

    const { value: isSyntaxModalOpen, toggle: toggleIsSyntaxModalOpen } = useBoolean(false);

    const scriptPanelId = useId("scriptPanel");
    const unsavedChangesId = useId("unsavedChanges");

    const saveEdit = () => {
        dispatch(
            conflictResolutionActions.saveEdit({
                oldName: initialCollectionsConfig.name,
                newConfig: {
                    name: collection,
                    script,
                },
            })
        );
    };

    const collectionOptions = allCollectionNames.map((x) => ({ label: x, value: x }));

    return (
        <RichPanel className="flex-row" id={scriptPanelId}>
            <div className="flex-grow-1">
                <RichPanelHeader>
                    <RichPanelInfo>
                        <RichPanelName>
                            {collection ?? "Collection name"}
                            <span id={unsavedChangesId} className="text-warning">
                                *
                            </span>
                            <UncontrolledTooltip target={unsavedChangesId}>
                                The script has not been saved yet
                            </UncontrolledTooltip>
                        </RichPanelName>
                    </RichPanelInfo>
                    <RichPanelActions>
                        {isDatabaseAdmin ? (
                            initialCollectionsConfig.isInEditMode ? (
                                <>
                                    <Button color="success" title="Save changes" onClick={saveEdit}>
                                        <Icon icon="save" margin="m-0" /> Save
                                    </Button>
                                    <Button
                                        color="secondary"
                                        title="Cancel changes"
                                        onClick={() => dispatch(conflictResolutionActions.discardEdit(collection))}
                                    >
                                        <Icon icon="cancel" margin="m-0" /> Discard
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <Button
                                        color="secondary"
                                        title="Edit this script"
                                        onClick={() => dispatch(conflictResolutionActions.edit(collection))}
                                    >
                                        <Icon icon="edit" margin="m-0" />
                                    </Button>
                                    <Button
                                        color="danger"
                                        title="Delete this script"
                                        onClick={() => dispatch(conflictResolutionActions.delete(collection))}
                                    >
                                        <Icon icon="trash" margin="m-0" />
                                    </Button>
                                </>
                            )
                        ) : (
                            <>
                                {initialCollectionsConfig.isInEditMode ? (
                                    <Button
                                        color="secondary"
                                        title="Hide this script"
                                        onClick={() => dispatch(conflictResolutionActions.discardEdit(collection))}
                                    >
                                        <Icon icon="preview-off" margin="m-0" />
                                    </Button>
                                ) : (
                                    <Button
                                        color="secondary"
                                        title="Show this script"
                                        onClick={() => dispatch(conflictResolutionActions.edit(collection))}
                                    >
                                        <Icon icon="preview" margin="m-0" />
                                    </Button>
                                )}
                            </>
                        )}
                    </RichPanelActions>
                </RichPanelHeader>
                <Collapse isOpen={!initialCollectionsConfig.isInEditMode}>
                    <RichPanelDetails>
                        <RichPanelDetailItem
                            label={
                                <>
                                    <Icon icon="clock" />
                                    Last modified
                                </>
                            }
                        >
                            {genUtils.formatUtcDateAsLocal(initialCollectionsConfig.lastModifiedTime)}
                        </RichPanelDetailItem>
                    </RichPanelDetails>
                </Collapse>
                <Collapse isOpen={initialCollectionsConfig.isInEditMode}>
                    <RichPanelDetails className="vstack gap-3 p-3">
                        {!initialCollectionsConfig.name && (
                            <InputGroup className="vstack mb-1">
                                <Label>Collection</Label>
                                <SelectCreatable
                                    options={collectionOptions}
                                    value={collectionOptions.find((x) => x.value === collection)}
                                    defaultValue={collectionOptions.find((x) => x.value === collection)}
                                    onChange={(x: SelectOption) => setCollection(x.value)}
                                    isClearable={false}
                                    placeholder="Select collection (or enter a new one)"
                                    maxMenuHeight={300}
                                    isDisabled={!isDatabaseAdmin}
                                />
                            </InputGroup>
                        )}
                        <InputGroup className="vstack">
                            <Label className="d-flex flex-wrap justify-content-between">
                                Script
                                <Button
                                    color="link"
                                    size="xs"
                                    onClick={toggleIsSyntaxModalOpen}
                                    className="p-0 align-self-end"
                                >
                                    Syntax
                                    <Icon icon="help" margin="ms-1" />
                                </Button>
                            </Label>
                            {isSyntaxModalOpen && (
                                <EditConflictResolutionSyntaxModal toggle={toggleIsSyntaxModalOpen} />
                            )}
                            <AceEditor
                                mode="javascript"
                                height="400px"
                                value={script}
                                onChange={setScript}
                                readOnly={!isDatabaseAdmin}
                            />
                        </InputGroup>
                    </RichPanelDetails>
                </Collapse>
            </div>
        </RichPanel>
    );
}
