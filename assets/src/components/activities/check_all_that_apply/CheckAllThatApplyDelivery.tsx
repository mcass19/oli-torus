import { Checkbox } from 'components/misc/icons/checkbox/Checkbox';
import { Manifest } from 'components/activities/types';
import { initialPartInputs, isCorrect } from 'data/activities/utils';
import {
  ActivityDeliveryState,
  initializeState,
  isEvaluated,
  setSelection,
  activityDeliverySlice,
  resetAction,
  listenForParentSurveySubmit,
  listenForParentSurveyReset,
  listenForReviewAttemptChange,
} from 'data/activities/DeliveryState';
import React, { useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { configureStore } from 'state/store';
import { DeliveryElement, DeliveryElementProps } from '../DeliveryElement';
import { DeliveryElementProvider, useDeliveryElementContext } from '../DeliveryElementProvider';
import { ResetButtonConnected } from 'components/activities/common/delivery/reset_button/ResetButtonConnected';
import { SubmitButtonConnected } from 'components/activities/common/delivery/submit_button/SubmitButtonConnected';
import { HintsDeliveryConnected } from 'components/activities/common/hints/delivery/HintsDeliveryConnected';
import { EvaluationConnected } from 'components/activities/common/delivery/evaluation/EvaluationConnected';
import { GradedPointsConnected } from 'components/activities/common/delivery/graded_points/GradedPointsConnected';
import { StemDeliveryConnected } from 'components/activities/common/stem/delivery/StemDelivery';
import { ChoicesDeliveryConnected } from 'components/activities/common/choices/delivery/ChoicesDeliveryConnected';
import { CATASchema } from 'components/activities/check_all_that_apply/schema';
import { castPartId } from '../common/utils';

export const CheckAllThatApplyComponent: React.FC = () => {
  const {
    state: activityState,
    context,
    onSubmitActivity,
    onResetActivity,
    onSaveActivity,
    model,
  } = useDeliveryElementContext<CATASchema>();
  const uiState = useSelector((state: ActivityDeliveryState) => state);
  const dispatch = useDispatch();
  const { surveyId } = context;
  useEffect(() => {
    listenForParentSurveySubmit(surveyId, dispatch, onSubmitActivity);
    listenForParentSurveyReset(surveyId, dispatch, onResetActivity, {
      [castPartId(activityState.parts[0].partId)]: [],
    });
    listenForReviewAttemptChange(model, activityState.activityId as number, dispatch, context);

    dispatch(
      initializeState(activityState, initialPartInputs(model, activityState), model, context),
    );
  }, []);

  const resetInputs = useMemo(
    () => ({ [castPartId(activityState.parts[0].partId)]: [] }),
    [activityState.parts],
  );

  // First render initializes state
  if (!uiState.partState) {
    return null;
  }

  return (
    <div className={`activity cata-activity ${isEvaluated(uiState) ? 'evaluated' : ''}`}>
      <div className="activity-content">
        <StemDeliveryConnected />
        <GradedPointsConnected />
        <ChoicesDeliveryConnected
          partId={castPartId(activityState.parts[0].partId)}
          unselectedIcon={<Checkbox.Unchecked disabled={isEvaluated(uiState)} />}
          selectedIcon={
            !isEvaluated(uiState) ? (
              <Checkbox.Checked />
            ) : isCorrect(uiState.attemptState) ? (
              <Checkbox.Correct />
            ) : (
              <Checkbox.Incorrect />
            )
          }
          onSelect={(id) =>
            dispatch(
              setSelection(
                castPartId(activityState.parts[0].partId),
                id,
                onSaveActivity,
                'multiple',
              ),
            )
          }
        />
        <ResetButtonConnected onReset={() => dispatch(resetAction(onResetActivity, resetInputs))} />
        <SubmitButtonConnected />
        <HintsDeliveryConnected
          partId={castPartId(activityState.parts[0].partId)}
          resetPartInputs={resetInputs}
        />
        <EvaluationConnected />
      </div>
    </div>
  );
};

// Defines the web component, a simple wrapper over our React component above
export class CheckAllThatApplyDelivery extends DeliveryElement<CATASchema> {
  render(mountPoint: HTMLDivElement, props: DeliveryElementProps<CATASchema>) {
    const store = configureStore({}, activityDeliverySlice.reducer);
    ReactDOM.render(
      <Provider store={store}>
        <DeliveryElementProvider {...props}>
          <CheckAllThatApplyComponent />
        </DeliveryElementProvider>
      </Provider>,
      mountPoint,
    );
  }
}

// Register the web component:
// eslint-disable-next-line
const manifest = require('./manifest.json') as Manifest;
window.customElements.define(manifest.delivery.element, CheckAllThatApplyDelivery);
