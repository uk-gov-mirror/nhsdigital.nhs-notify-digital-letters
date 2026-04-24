import type { Dimension } from '@aws-sdk/client-cloudwatch';

export type { Dimension as MetricDimension } from '@aws-sdk/client-cloudwatch';

export type MetricUnit =
  | 'Seconds'
  | 'Microseconds'
  | 'Milliseconds'
  | 'Bytes'
  | 'Kilobytes'
  | 'Megabytes'
  | 'Gigabytes'
  | 'Terabytes'
  | 'Bits'
  | 'Kilobits'
  | 'Megabits'
  | 'Gigabits'
  | 'Terabits'
  | 'Percent'
  | 'Count'
  | 'Bytes/Second'
  | 'Kilobytes/Second'
  | 'Megabytes/Second'
  | 'Gigabytes/Second'
  | 'Terabytes/Second'
  | 'Bits/Second'
  | 'Kilobits/Second'
  | 'Megabits/Second'
  | 'Gigabits/Second'
  | 'Terabits/Second'
  | 'Count/Second'
  | 'None';

type Metric = [name: string, unit: MetricUnit, value: number];

export class MetricHandler {
  // Used in add metric calls so that all dimensions can be present in a namespace to simplify aggregation
  public static readonly DIMENSION_NOT_APPLICABLE = 'not_applicable';

  constructor(
    private readonly namespace: string,
    private readonly dimensions: Dimension[]
  ) {}

  public addMetrics(
    metricOrMetrics: Metric | Metric[],
    options: {
      timestamp?: Date;
      extraDimensions?: Dimension[];
      storageResolution?: number;
    } = {}
  ) {
    const {
      timestamp = new Date(),
      extraDimensions = [],
      storageResolution = 60,
    } = options;

    const metrics = (
      Array.isArray(metricOrMetrics) && Array.isArray(metricOrMetrics[0])
        ? metricOrMetrics
        : [metricOrMetrics]
    ) as Metric[];

    const dimensions: Record<string, string> = {};

    for (const dimension of [...this.dimensions, ...extraDimensions]) {
      dimensions[dimension.Name as string] = dimension.Value as string;
    }

    const metric = {
      _aws: {
        Timestamp: timestamp.valueOf(),
        CloudWatchMetrics: [
          {
            Namespace: this.namespace,
            Dimensions: [Object.keys(dimensions)],
            Metrics: metrics.map(([name, unit]) => ({
              Name: name,
              Unit: unit,
              StorageResolution: storageResolution,
            })),
          },
        ],
      },
      ...dimensions,
      ...Object.fromEntries(metrics.map(([name, , value]) => [name, value])),
    };
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(metric));
  }

  public getChildMetricHandler(
    childMetricHandlerDimensions: Dimension[]
  ): MetricHandler {
    return new MetricHandler(this.namespace, [
      ...this.dimensions,
      ...childMetricHandlerDimensions,
    ]);
  }
}
