export async function asyncMap(

    array = [],

    callback

) {

    return Promise.all(

        array.map(callback)

    );

}

export async function asyncForEach(

    array = [],

    callback

) {

    for (const item of array) {

        await callback(item);

    }

}

export async function asyncFilter(

    array = [],

    predicate

) {

    const results = await Promise.all(

        array.map(predicate)

    );

    return array.filter(

        (_, index) => results[index]

    );

}

export async function retry(

    callback,

    attempts = 3,

    delay = 1000

) {

    let error;

    for (

        let attempt = 1;

        attempt <= attempts;

        attempt++

    ) {

        try {

            return await callback();

        }

        catch (exception) {

            error = exception;

            if (

                attempt < attempts

            ) {

                await new Promise(

                    resolve =>

                        setTimeout(

                            resolve,

                            delay

                        )

                );

            }

        }

    }

    throw error;

}

export async function timeout(

    promise,

    milliseconds

) {

    return Promise.race([

        promise,

        new Promise(

            (_, reject) =>

                setTimeout(

                    () =>

                        reject(

                            new Error(

                                "Operation timed out."

                            )

                        ),

                    milliseconds

                )

        )

    ]);

}