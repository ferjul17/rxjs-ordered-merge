import {Observable, merge, Subscriber} from "rxjs";
import {mergeMap} from "rxjs/operators";

export function orderedMerge<T>(concurrent?: number): (source: Observable<Observable<T>>) => Observable<T> {

    const buffer: Array<{ subscriber: Subscriber<T>, values: T[], completed: boolean }> = [];

    let current: number = 0;

    return ((source: Observable<Observable<T>>): Observable<T> => {
        return merge(source.pipe(
            mergeMap((observable, index): Observable<T> => {
                return new Observable<T>((subscriber): void => {
                    buffer[index] = {subscriber, values: [], completed: false};
                    observable.subscribe({
                        next: (value: T): void => {
                            if (current === index) {
                                subscriber.next(value);
                            } else {
                                buffer[index].values.push(value);
                            }
                        },
                        complete: (): void => {
                            if (current === index) {
                                subscriber.complete();
                                delete buffer[index]; // save memory
                                for (current++; buffer[current]; current++) {
                                    for (const value of buffer[current].values) {
                                        buffer[current].subscriber.next(value);
                                    }
                                    if (!buffer[current].completed) {
                                        buffer[current].values = []; // save memory
                                        break;
                                    }
                                    buffer[current].subscriber.complete();
                                    delete buffer[current]; // save memory
                                }
                            } else {
                                buffer[index].completed = true;
                            }
                        },
                    });
                });
            }, concurrent)
        ));
    });
}
