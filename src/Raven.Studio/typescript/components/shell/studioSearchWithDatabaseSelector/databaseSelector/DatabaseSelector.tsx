import "./DatabaseSelector.scss";
import React from "react";
import databasesManager from "common/shell/databasesManager";
import { Icon } from "components/common/Icon";
import { databaseSelectors } from "components/common/shell/databaseSliceSelectors";
import { useAppSelector } from "components/store";
import { UncontrolledDropdown, DropdownToggle, DropdownMenu, DropdownItem } from "reactstrap";

export default function DatabaseSelector() {
    const allDatabaseNames = useAppSelector(databaseSelectors.allDatabaseNames);
    const activeDatabaseName = useAppSelector(databaseSelectors.activeDatabaseName);

    return (
        <UncontrolledDropdown>
            <DropdownToggle className="database-selector" caret>
                <div>
                    <Icon icon="database" />
                    {activeDatabaseName || "No database selected"}
                </div>
                <DropdownMenu className="w-fit-content">
                    {allDatabaseNames.map((databaseName) => (
                        <DropdownItem
                            key={databaseName}
                            onClick={() => {
                                const db = databasesManager.default.getDatabaseByName(databaseName);
                                databasesManager.default.activate(db);
                            }}
                        >
                            {databaseName}
                        </DropdownItem>
                    ))}
                </DropdownMenu>
            </DropdownToggle>
        </UncontrolledDropdown>
    );
}
