import DatabaseSelector from "components/shell/studioSearchWithDatabaseSelector/databaseSelector/DatabaseSelector";
import StudioSearch from "components/shell/studioSearchWithDatabaseSelector/studioSearch/StudioSearch";
import React from "react";
import { InputGroup } from "reactstrap";

export default function StudioSearchWithDatabaseSelector() {
    return (
        <InputGroup>
            <StudioSearch />
            <DatabaseSelector />
        </InputGroup>
    );
}
