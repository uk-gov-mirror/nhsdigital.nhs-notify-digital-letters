import axios, { AxiosInstance, isAxiosError } from 'axios';
import type { AxiosError } from 'axios';
import type { Readable } from 'node:stream';
import { constants as HTTP2_CONSTANTS } from 'node:http2';
import type {
  SingleMessageErrorResponse,
  SingleMessageRequest,
  SingleMessageResponse,
} from 'domain/request';
import { RequestAlreadyReceivedError } from 'domain/request-already-received-error';
import { RetryConfig, conditionalRetry } from 'utils';
import type { Logger } from 'utils';
import { RequestNotifyError } from 'domain/request-notify-error';

export interface IAccessTokenRepository {
  getAccessToken(): Promise<string>;
}

export type Response = {
  data: Readable;
};

export interface INotifyClient {
  sendRequest(
    apiRequest: SingleMessageRequest,
    correlationId?: string,
  ): Promise<SingleMessageResponse>;
}
/*
 * Client for sending requests to the NHS Notify API see
 *  https://digital.nhs.uk/developer/api-catalogue/nhs-notify
 */
export class NotifyClient implements INotifyClient {
  private client: AxiosInstance;

  constructor(
    private apimBaseUrl: string,
    private accessTokenRepository: IAccessTokenRepository,
    private logger: Logger,
    private backoffConfig: RetryConfig = {
      maxDelayMs: 10_000,
      intervalMs: 1000,
      exponentialRate: 2,
      maxAttempts: 10,
    },
  ) {
    this.client = axios.create({
      baseURL: this.apimBaseUrl,
    });
  }

  public async sendRequest(
    apiRequest: SingleMessageRequest,
    correlationId: string,
  ): Promise<SingleMessageResponse> {
    try {
      return await conditionalRetry(
        async (attempt) => {
          const accessToken = await this.accessTokenRepository.getAccessToken();

          this.logger.debug({
            correlationId,
            description: 'Sending request',
            attempt,
          });

          const headers = {
            'Content-Type': 'application/json',
            'X-Correlation-ID': correlationId,
            ...(accessToken === ''
              ? {}
              : {
                  Authorization: `Bearer ${accessToken}`,
                }),
          };
          const response = await this.client.post<SingleMessageResponse>(
            '/comms/v1/messages',
            apiRequest,
            { headers },
          );

          return response.data;
        },
        (err) =>
          Boolean(
            isAxiosError(err) &&
            err.response?.status ===
              HTTP2_CONSTANTS.HTTP_STATUS_TOO_MANY_REQUESTS,
          ),
        this.backoffConfig,
      );
    } catch (error: any) {
      this.logger.error({
        description: 'Failed sending request to Notify',
        err: error,
      });

      if (isAxiosError(error)) {
        const axiosError: AxiosError = error;
        if (
          axiosError.response?.status ===
          HTTP2_CONSTANTS.HTTP_STATUS_UNPROCESSABLE_ENTITY
        ) {
          throw new RequestAlreadyReceivedError(error, correlationId);
        } else {
          const errorBody: SingleMessageErrorResponse = axiosError.response
            ?.data as SingleMessageErrorResponse;
          throw new RequestNotifyError(
            error,
            correlationId,
            errorBody?.errors[0].code,
            errorBody?.errors[0].detail,
          );
        }
      }

      throw error;
    }
  }
}
