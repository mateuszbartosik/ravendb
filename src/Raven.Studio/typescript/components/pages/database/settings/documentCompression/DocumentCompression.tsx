import React, { useState } from "react";
import { Col, Button, Row, Input, InputGroup, Card, Collapse } from "reactstrap";
import { Icon } from "components/common/Icon";
import classNames from "classnames";
import { RadioToggleWithIcon, RadioToggleWithIconInputItem } from "components/common/RadioToggle";
import { Switch } from "components/common/Checkbox";
import useBoolean from "components/hooks/useBoolean";
import { EmptySet } from "components/common/EmptySet";
import { FlexGrow } from "components/common/FlexGrow";
import {
    AboutViewAnchored,
    AboutViewHeading,
    AccordionItemLicensing,
    AccordionItemWrapper,
} from "components/common/AboutView";

export default function DocumentCompression() {
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
        <div className="content-margin">
            <Col xxl={12}>
                <Row className="gy-sm">
                    <Col>
                        <AboutViewHeading
                            title="Document Compression"
                            icon="documents-compression"
                            badge
                            badgeText="Enterprise"
                        />
                        <div className="hstack mb-3">
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
                            <Switch
                                selected={compressRevisions}
                                toggleSelection={toggle}
                                color="primary"
                                className="mb-4"
                            >
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
                                        <Col sm="auto" className="d-flex">
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

                                                    <Button
                                                        color="link"
                                                        size="xs"
                                                        onClick={() => removeCollection(collection)}
                                                    >
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
                                            <li>New documents created in all collections</li>
                                            <li>Existing documents that are modified & saved in all collections</li>
                                        </ul>
                                    </div>
                                </div>
                            </Collapse>
                        </Card>
                    </Col>
                    <Col sm={12} lg={4}>
                        <AboutViewAnchored>
                            <AccordionItemWrapper
                                targetId="aboutView"
                                icon="about"
                                color="info"
                                heading="About this view"
                                description="Get additional info on what this feature can offer you"
                            >
                                <p>
                                    <strong>Document Compression</strong> is a licensed feature that allows compression
                                    of data stored in RavenDB. This feature can help reduce the storage requirements for
                                    large databases and improve query performance by reducing the amount of data that
                                    needs to be read from disk.
                                </p>
                                <p>
                                    This feature is particularly useful for time-series data, where the same data is
                                    often repeated over time. With document compression, the repeated data can be stored
                                    more efficiently, reducing storage requirements and improving query performance.
                                </p>
                                <hr />
                                <div className="small-label mb-2">useful links</div>
                                <a href="https://ravendb.net/l/IBUJ7M/6.0/Csharp" target="_blank">
                                    <Icon icon="newtab" /> Docs - Document Compression
                                </a>
                            </AccordionItemWrapper>
                            <AccordionItemWrapper
                                targetId="licensing"
                                icon="license"
                                color="warning"
                                heading="Licensing"
                                description="See which plans offer this and more exciting features"
                                pill
                                pillText="Upgrade available"
                                pillIcon="star-filled"
                            >
                                <AccordionItemLicensing
                                    description="This feature is not available in your license. Unleash the full potential and upgrade your plan."
                                    featureName="Document Compression"
                                    featureIcon="documents-compression"
                                    checkedLicenses={["Enterprise"]}
                                >
                                    <p className="lead fs-4">Get your license expanded</p>
                                    <div className="mb-3">
                                        <Button
                                            color="primary"
                                            href="https://ravendb.net/contact"
                                            target="_blank"
                                            className="rounded-pill"
                                        >
                                            <Icon icon="notifications" />
                                            Contact us
                                        </Button>
                                    </div>
                                    <small>
                                        <a href="https://ravendb.net/buy" target="_blank" className="text-muted">
                                            See pricing plans
                                        </a>
                                    </small>
                                </AccordionItemLicensing>
                            </AccordionItemWrapper>
                        </AboutViewAnchored>
                    </Col>
                </Row>
            </Col>
        </div>
    );
}
