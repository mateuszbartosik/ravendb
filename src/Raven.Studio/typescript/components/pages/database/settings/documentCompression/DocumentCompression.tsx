import React, { useState } from "react";
import { Col, Button, Row, Input, InputGroup, Card, Collapse, FormFeedback } from "reactstrap";
import { Icon } from "components/common/Icon";

import classNames from "classnames";
import { RadioToggleWithIcon, RadioToggleWithIconInputItem } from "components/common/RadioToggle";
import { Switch } from "components/common/Checkbox";
import useBoolean from "components/hooks/useBoolean";
import { EmptySet } from "components/common/EmptySet";
import { FlexGrow } from "components/common/FlexGrow";

// interface DocumentCompressionProps {

// }

// TODO: show modal on exit intent if is dirty
export default function DocumentCompression() {
    // const { manageServerService } = useServices();
    // const asyncGetClientConfiguration = useAsyncCallback(manageServerService.getClientConfiguration);
    // const asyncGetClientGlobalConfiguration = useAsync(manageServerService.getGlobalClientConfiguration, []);

    // const { isClusterAdminOrClusterNode: canNavigateToServerSettings } = useAccessManager();

    // const { handleSubmit, control, formState, setValue, reset } = useForm<ClientConfigurationFormData>({
    //     resolver: clientConfigurationYupResolver,
    //     mode: "all",
    //     defaultValues: async () =>
    //         ClientConfigurationUtils.mapToFormData(await asyncGetClientConfiguration.execute(db), false),
    // });

    // const formValues = useClientConfigurationFormController(control, setValue);

    // useEffect(() => {
    //     if (formState.isSubmitSuccessful) {
    //         reset(formValues);
    //     }
    // }, [formState.isSubmitSuccessful, reset, formValues]);

    // const globalConfig = useMemo(() => {
    //     const globalConfigResult = asyncGetClientGlobalConfiguration.result;
    //     if (!globalConfigResult) {
    //         return null;
    //     }

    //     return ClientConfigurationUtils.mapToFormData(globalConfigResult, true);
    // }, [asyncGetClientGlobalConfiguration.result]);

    // const onSave: SubmitHandler<ClientConfigurationFormData> = async (formData) => {
    //     tryHandleSubmit(async () => {
    //         await manageServerService.saveClientConfiguration(ClientConfigurationUtils.mapToDto(formData, false), db);
    //     });
    // };

    // const onRefresh = async () => {
    //     reset(ClientConfigurationUtils.mapToFormData(await asyncGetClientConfiguration.execute(db), false));
    // };

    // if (asyncGetClientConfiguration.loading || asyncGetClientGlobalConfiguration.loading) {
    //     return <LoadingView />;
    // }

    // if (asyncGetClientConfiguration.error) {
    //     return <LoadError error="Unable to load client configuration" refresh={onRefresh} />;
    // }

    // const canEditDatabaseConfig = formValues.overrideConfig || !globalConfig;
    const leftRadioToggleItem: RadioToggleWithIconInputItem = {
        label: "Compress selected collections",
        value: "selected",
        iconName: "document",
    };

    const rightRadioToggleItem: RadioToggleWithIconInputItem = {
        label: "Compress all collections",
        value: "all",
        iconName: "documents",
    };

    const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
    const [animateNewItem, setAnimateNewItem] = useState(false);

    const onAnimationEnd = () => {
        setAnimateNewItem(false);
    };
    const [newCollection, setNewCollection] = useState("");
    const addCollection = () => {
        if (newCollection !== "" && !selectedCollections.includes(newCollection)) {
            setSelectedCollections([newCollection, ...selectedCollections]);
            setNewCollection("");
            setAnimateNewItem(true);
        }
    };

    const removeCollection = (removedCollection: string) => {
        const newSellectedCollections = selectedCollections.filter((collection) => collection !== removedCollection);
        setSelectedCollections(newSellectedCollections);
    };

    const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
            addCollection();
        }
    };

    const [radioToggleSelectedValue, setRadioToggleSelectedValue] = useState(leftRadioToggleItem.value);

    const { value: compressRevisions, toggle } = useBoolean(false);

    return (
        <>
            <div className="hstack mb-4">
                <Button color="primary">
                    <Icon icon="save" /> Save
                </Button>
                <FlexGrow />
                <Button color="link" href="#">
                    <Icon icon="link" /> Storage Report
                </Button>
            </div>
            <Card className="p-4">
                <RadioToggleWithIcon
                    name="some-name"
                    leftItem={leftRadioToggleItem}
                    rightItem={rightRadioToggleItem}
                    selectedValue={radioToggleSelectedValue}
                    setSelectedValue={(x) => setRadioToggleSelectedValue(x)}
                    className="mb-4"
                />
                <Switch selected={compressRevisions} toggleSelection={toggle} color="primary" className="mb-4">
                    Compress revisions for all collections
                </Switch>
                <Collapse isOpen={radioToggleSelectedValue === "selected"}>
                    <div className="pb-2">
                        <Row>
                            <Col>
                                <InputGroup>
                                    <Input
                                        invalid={selectedCollections.includes(newCollection)}
                                        value={newCollection}
                                        onChange={(e) => setNewCollection(e.target.value)}
                                        onKeyDownCapture={handleKeyPress}
                                        placeholder="Select collection (or enter new collection)"
                                    />
                                    <div
                                        className={classNames("invalid-tooltip", {
                                            "d-block": selectedCollections.includes(newCollection),
                                        })}
                                    >
                                        Collection already added
                                    </div>
                                    <Button color="success" onClick={addCollection}>
                                        <Icon icon="document" addon="plus" /> Add
                                    </Button>
                                </InputGroup>
                            </Col>
                            <Col sm="auto">
                                <Button color="info">
                                    <Icon icon="documents" addon="plus" /> Add All
                                </Button>
                            </Col>
                        </Row>
                        <h3 className="mt-3">Selected Collections:</h3>
                        <div className="well p-2">
                            <div className="simple-item-list">
                                {selectedCollections.map((collection, index) => (
                                    <div
                                        key={collection}
                                        className={classNames("p-1 hstack add-hover", {
                                            "blink-style": index === 0 && animateNewItem,
                                        })}
                                        onAnimationEnd={onAnimationEnd}
                                    >
                                        <div className="flex-grow-1 pl-2">{collection}</div>

                                        <Button color="link" size="xs" onClick={() => removeCollection(collection)}>
                                            <Icon icon="trash" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                            <Collapse isOpen={selectedCollections.length === 0}>
                                <EmptySet>No collections have been selected</EmptySet>
                            </Collapse>
                        </div>
                    </div>
                </Collapse>
                <Collapse isOpen={radioToggleSelectedValue === "all" || selectedCollections.length !== 0}>
                    <div className="bg-faded-info hstack gap-3 p-3">
                        <Icon icon="documents-compression" className="fs-1" />
                        <div>
                            Documents that will be compressed:
                            <ul className="m-0">
                                <li>New documents created in all collections Existing documents</li>
                                <li>that are modified & saved in all collections</li>
                            </ul>
                        </div>
                    </div>
                </Collapse>
            </Card>
        </>
    );
}
