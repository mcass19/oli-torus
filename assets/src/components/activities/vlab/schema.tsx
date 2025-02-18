import { SelectOption } from 'components/activities/common/authoring/InputTypeDropdown';
import {
  Stem,
  ActivityModelSchema,
  ChoiceIdsToResponseId,
  Part,
  Transformation,
  Choice,
  ChoiceId,
} from 'components/activities/types';
import { Identifiable } from 'data/content/model/other';

export type VlabInput = Dropdown | FillInTheBlank | VlabValue;
export type VlabInputDelivery =
  | { id: string; inputType: 'dropdown'; options: SelectOption[] }
  | { id: string; inputType: 'text' | 'numeric' | 'vlabvalue' };

export interface Dropdown extends Identifiable {
  inputType: 'dropdown';
  partId: string;
  choiceIds: ChoiceId[];
}
export interface FillInTheBlank extends Identifiable {
  inputType: 'text' | 'numeric';
  partId: string;
}

export interface VlabValue extends Identifiable {
  inputType: 'vlabvalue';
  partId: string;
  species: string;
  parameter: string;
}
import { MultiInputType } from 'components/activities/multi_input/schema';
export type VlabInputType = MultiInputType | 'vlabvalue';

export type VlabParameter =
  | 'volume'
  | 'temp'
  | 'moles'
  | 'mass'
  | 'molarity'
  | 'concentration'
  | 'pH';

export interface VlabSchema extends ActivityModelSchema {
  stem: Stem;
  // This is a separated out rather than putting a dropdown's choices under
  // its item in the `inputs` array because the backend transformation logic
  // take a string key to shuffle, and doesn't allow for predicate logic.
  choices: Choice[];
  // The actual student-answerable inputs, designated by their type
  inputs: VlabInput[];
  assignmentSource: string;
  assignmentPath: string;
  assignment: string;
  configuration: string;
  reactions: string;
  solutions: string;
  species: string;
  spectra: string;
  authoring: {
    targeted: ChoiceIdsToResponseId[];
    parts: Part[];
    transformations: Transformation[];
    previewText: string;
  };
}
