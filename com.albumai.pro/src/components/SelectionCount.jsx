import React, { useEffect, useState } from "react";

function SelectionCount({ selection }) {

    const [count, setCount] = useState(
        () => selection.getSelected().length
    );

    useEffect(
        () => selection.subscribe(
            selectedIds => setCount(selectedIds.size)
        ),
        [selection]
    );

    return <>{count}</>;

}

export default React.memo(SelectionCount);
