import {defer, from, of} from "rxjs";
import {delay, reduce, tap} from "rxjs/operators";
import {orderedMerge} from "../src/orderedMerge";
import {expect} from "chai";

function makePromise<T>(result: T, _delay: number): Promise<T> {
    return of(result).pipe(delay(_delay)).toPromise();
}

describe("orderedMerge", () => {

    it("should return in correct order", async () => {
        const numbers = await from([
            defer(() => makePromise(0, 1)),
            defer(() => makePromise(1, 0)),
            defer(() => makePromise(2, 2)),
            defer(() => makePromise(3, 0)),
            defer(() => makePromise(4, 3)),
            defer(() => makePromise(5, 0)),
        ]).pipe(
            orderedMerge(2),
            reduce((acc: number[], value: number): number[] => [...acc, value], [] as number[])
        ).toPromise();

        expect(numbers).to.be.deep.equal([0, 1, 2, 3, 4, 5]);
    });

    it("should run limited concurrent jobs", async () => {
        let concurrentJobs: number = 0;

        const inc = (cpt: number, below: number) => {
            expect(cpt).to.below(below);
            return ++cpt;
        };
        const dec = (cpt: number, above: number = 0) => {
            expect(cpt).to.above(above);
            return --cpt;
        };
        const makeDefer = () => defer(() => {
            concurrentJobs = inc(concurrentJobs, 2);
            return makePromise(0, 1)
        });

        await from([
            makeDefer(),
            makeDefer(),
            makeDefer(),
            makeDefer(),
            makeDefer(),
            makeDefer(),
        ]).pipe(
            orderedMerge(2),
            tap(() => concurrentJobs = dec(concurrentJobs))
        ).toPromise();

        expect(concurrentJobs).to.be.equal(0);
    });

    it("should run unlimited concurrent jobs", async () => {
        const length = 100;
        const concurrentJobs: number[] = [];

        const makeDefer = () => defer(() => {
            concurrentJobs.push(concurrentJobs.length !== 0 ? concurrentJobs[concurrentJobs.length - 1] + 1 : 1);
            return makePromise(0, 1)
        });

        await from(Array.from({length}, () => makeDefer())).pipe(
            orderedMerge(),
            tap(() => {
                concurrentJobs.push(concurrentJobs[concurrentJobs.length - 1] - 1)
            })
        ).toPromise();

        expect(Math.max(...concurrentJobs)).to.be.equal(length);
        expect(Math.min(...concurrentJobs)).to.be.equal(0);
    });

});
