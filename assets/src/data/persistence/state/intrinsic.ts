import { makeRequest } from '../common';
import { encodeFile, getFileName } from 'data/persistence/media';

export type BulkAttemptRetrieved = {
  result: 'success';
  activityAttempts: any[];
};

export const getBulkAttemptState = async (sectionSlug: string, attemptGuids: string[]) => {
  const params = {
    method: 'POST',
    url: `/state/course/${sectionSlug}/activity_attempt`,
    body: JSON.stringify({ attemptGuids }),
  };

  const response = await makeRequest<BulkAttemptRetrieved>(params);
  if (response.result !== 'success') {
    throw new Error(`Server ${response.status} error: ${response.message}`);
  }

  return response.activityAttempts;
};

export const getPageAttemptState = async (sectionSlug: string, resourceAttemptGuid: string) => {
  const url = `/state/course/${sectionSlug}/resource_attempt/${resourceAttemptGuid}`;
  const result = await makeRequest({
    url,
    method: 'GET',
  });
  return { result };
};

export const writePageAttemptState = async (
  sectionSlug: string,
  resourceAttemptGuid: string,
  state: any,
) => {
  const method = 'PUT';
  const url = `/state/course/${sectionSlug}/resource_attempt/${resourceAttemptGuid}`;
  const result = await makeRequest({
    url,
    method,
    body: JSON.stringify(state),
  });
  return { result };
};

export interface PartResponse {
  attemptGuid: string;
  response: any;
}

export const writeActivityAttemptState = async (
  sectionSlug: string,
  attemptGuid: string,
  partResponses: PartResponse[],
  finalize = false,
) => {
  const method = finalize ? 'PUT' : 'PATCH';
  const url = `/state/course/${sectionSlug}/activity_attempt/${attemptGuid}`;
  const result = await makeRequest<{ type: 'success' }>({
    url,
    method,
    body: JSON.stringify({ partInputs: partResponses }),
  });

  return { result: result.type };
};

export const writePartAttemptState = async (
  sectionSlug: string,
  attemptGuid: string,
  partAttemptGuid: string,
  input: any,
  finalize = false,
) => {
  console.info('writePartAttemptState');
  const method = finalize ? 'PUT' : 'PATCH';
  const url = `/state/course/${sectionSlug}/activity_attempt/${attemptGuid}/part_attempt/${partAttemptGuid}`;
  const result = await makeRequest({
    url,
    method,
    body: JSON.stringify({ response: input }),
  });
  return { result };
};

export const createNewActivityAttempt = async (
  sectionSlug: string,
  attemptGuid: string,
  seedResponsesWithPrevious = false,
): Promise<any> => {
  // type ActivityState ? this is in components currently
  const method = 'POST';
  const url = `/state/course/${sectionSlug}/activity_attempt/${attemptGuid}`;
  const result = await makeRequest({
    url,
    method,
    body: JSON.stringify({ seedResponsesWithPrevious }),
  });
  return result;
};

export const evalActivityAttempt = async (
  sectionSlug: string,
  attemptGuid: string,
  partInputs: any[], // TODO: type for PartInput / PartResponse
) => {
  const method = 'PUT';
  const url = `/state/course/${sectionSlug}/activity_attempt/${attemptGuid}`;
  const body = JSON.stringify({ partInputs });
  const result = await makeRequest({
    url,
    method,
    body,
  });
  return { result };
};

export type AttemptFileCreated = {
  result: 'success';
  url: string;
  creationDate: number;
  fileSize: number;
};

export function uploadActivityFile(
  sectionSlug: string,
  activityAttemptGuid: string,
  partAttemptGuid: string,
  file: File,
) {
  const fileName = getFileName(file);
  const url = `/state/course/${sectionSlug}/activity_attempt/${activityAttemptGuid}/part_attempt/${partAttemptGuid}/upload`;

  return encodeFile(file).then((encoding: string) => {
    const body = {
      file: encoding,
      name: fileName,
    };
    const params = {
      method: 'POST',
      body: JSON.stringify(body),
      url,
    };

    return makeRequest<AttemptFileCreated>(params);
  });
}
