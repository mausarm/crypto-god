import { createReducer, on, Action } from '@ngrx/store';
import { INITIAL_ASSETS, INITIAL_UI_STATE, INITIAL_OFFER_STATE, INITIAL_QUEST } from 'src/app/store/initial_state';
import * as fromActions from 'src/app/store/actions';
import { BUYSELL_VALUE, QUEST_DURATION, QUEST_REWARD, QUEST_STATUS, QUEST_TYPE, RADIOCHECKED, RANGES, STATUS } from './global_constants';
import { calculateTotalAssets } from '../logic/calculate_total';
import { mergedInto } from '../logic/merged_into';
import { Quest } from './quest';
import { calculateQuestScore } from '../logic/calculate_quest_score';
import { calculateQuestTarget } from '../logic/calculate_quest_target';



export const assetReducer = createReducer(
  INITIAL_ASSETS,

  on(fromActions.updateAssetsSuccess, (assets, { updatedAssets }) => {
    return mergedInto(updatedAssets, assets);
  }),

  on(fromActions.addAsset, (assets, { newAsset }) => {
    return assets.map((a) => {
      if (a.status !== STATUS.total) {
        return a;
      }
      else {
        return calculateTotalAssets([...assets, newAsset]);
      }
    }).concat(newAsset);
  }),

  on(fromActions.buyAsset, (assets, { assetID }) => {

    const usd = assets.find((a) => a.status === STATUS.usd).clone();
    const assetToBuy = assets.find((a) => a.id === assetID).clone();
    //wenn noch BUYSELL_VALUE USD vorhanden sind, dann wird im Wert von BUYSELL_VALUE USD gekauft
    if (usd.amount_history[usd.amount_history.length - 1] >= BUYSELL_VALUE) {
      assetToBuy.amount_history.push(assetToBuy.amount_history[assetToBuy.amount_history.length - 1] + (BUYSELL_VALUE / assetToBuy.price));
      usd.amount_history.push(usd.amount_history[usd.amount_history.length - 1] - BUYSELL_VALUE);
    }
    //ansonsten werden alle restlichen USD investiert
    else {
      assetToBuy.amount_history.push(assetToBuy.amount_history[assetToBuy.amount_history.length - 1] + (usd.amount_history[usd.amount_history.length - 1] / assetToBuy.price));
      usd.amount_history.push(0);
    }

    //wenn erster Buy-Sell-Vorgang oder
    //seit dem letzten BuySell-Vorgang mehr als eine Minute vergangen ist,
    //dann neuen Eintrag in die Amount-Timestamps
    if ((assetToBuy.amount_timestamps.length === 0) ||
      (assetToBuy.amount_timestamps[assetToBuy.amount_timestamps.length - 1].getTime() < new Date().getTime() - 60000)) {
      assetToBuy.amount_timestamps.push(new Date());
      usd.amount_timestamps.push(new Date());
    }
    //wenn nicht, dann die vorigen Amounts aus der History löschen
    else {
      assetToBuy.amount_history.splice(assetToBuy.amount_history.length - 2, 1);
      usd.amount_history.splice(usd.amount_history.length - 2, 1);
    }


    const result = assets.map((a) => {
      if (a.status === STATUS.usd) {
        return usd;
      }
      else if (a.id === assetID) {
        return assetToBuy;
      }
      else {
        return a;
      }
    })

    return result;
  }),

  on(fromActions.sellAsset, (assets, { assetId: assetID }) => {

    const usd = assets.find((a) => a.status === STATUS.usd).clone();
    const assetToSell = assets.find((a) => a.id === assetID).clone();

    //wenn noch Asset im Wert von über 1000USD vorhanden ist, dann wird im Wert von 1000USD verkauft
    if (assetToSell.amount_history[assetToSell.amount_history.length - 1] * assetToSell.price > BUYSELL_VALUE) {
      assetToSell.amount_history.push(assetToSell.amount_history[assetToSell.amount_history.length - 1] - (BUYSELL_VALUE / assetToSell.price));
      usd.amount_history.push(usd.amount_history[usd.amount_history.length - 1] + BUYSELL_VALUE);
    }
    //wenn weniger vorhanden ist, dann wird der Rest verkauft
    else {
      usd.amount_history.push(usd.amount_history[usd.amount_history.length - 1] + assetToSell.amount_history[assetToSell.amount_history.length - 1] * assetToSell.price);
      assetToSell.amount_history.push(0);
    }
    //wenn erster Buy-Sell Vorgang  oder
    //seit dem letzten BuySell-Vorgang mehr als eine Minute vergangen ist,
    //dann neuen Eintrag in die Amount-Timestamps
    if ((assetToSell.amount_timestamps.length === 0) ||
      (assetToSell.amount_timestamps[assetToSell.amount_timestamps.length - 1].getTime() < new Date().getTime() - 60000)) {
      assetToSell.amount_timestamps.push(new Date());
      usd.amount_timestamps.push(new Date());
    }
    //wenn nicht, dann die vorigen Amounts aus der History löschen
    else {
      assetToSell.amount_history.splice(assetToSell.amount_history.length - 2, 1);
      usd.amount_history.splice(usd.amount_history.length - 2, 1);
    }

    return assets.map((a) => {
      if (a.status === STATUS.usd) {
        return usd;
      }
      else if (a.id === assetID) {
        return assetToSell;
      }
      else {
        return a;
      }
    })
  }),

  on(fromActions.changeAssetOrder, (assets, { moveAssetId, inPlaceOfAssetId }) => {
    const before: number = assets.findIndex((a) => a.id === moveAssetId);
    const after: number = assets.findIndex((a) => a.id === inPlaceOfAssetId);
    if (before < after) {
      return assets.slice(0, before).concat(assets.slice(before + 1, after + 1)).concat(assets[before]).concat(assets.slice(after + 1, assets.length))
    }
    else {
      return assets.slice(0, after).concat(assets[before]).concat(assets.slice(after, before)).concat(assets.slice(before + 1, assets.length))
    }
  }),

  on(fromActions.loadStateSuccess, (assets, { loadedState }) => {
    return loadedState.assets;
  }),

  on(fromActions.findNewOfferSuccess, (assets, { offeredAssets }) => {
    return assets.concat(offeredAssets);
  }),

  on(fromActions.deleteOffered, (assets, { }) => {
    return assets.filter((a) => a.status != STATUS.offered);
  }),

  on(fromActions.getReward, (assets, { }) => {

    const usd = assets.find((a) => a.status === STATUS.usd).clone();
    const total = assets.find((a) => a.status === STATUS.total).clone();
    const newTotal = total.amount_history[0] + QUEST_REWARD;

    usd.amount_history.push(usd.amount_history[usd.amount_history.length - 1] + QUEST_REWARD);
    usd.amount_timestamps.push(new Date());

    total.amount_history = [newTotal];
    total.amount_timestamps = [new Date()];

    for (let range = 0; range <= RANGES.all; range++) {
      total.history[range].prices.pop();
      total.history[range].prices.push(newTotal);
      total.history[range].timestamps.pop();
      total.history[range].timestamps.push(new Date());
    }

    return assets.map((a) => {
      if (a.status === STATUS.usd) {
        return usd;
      }
      else if (a.status === STATUS.total){
        return total;
      }
      else {
        return a;
      }
    })
  }),


);













export const uiStateReducer = createReducer(
  INITIAL_UI_STATE,

  on(fromActions.loadStateSuccess, (uiState, { loadedState }) => ({
    ...loadedState.uiState,
    radioChecked: RADIOCHECKED.none
  })),

  on(fromActions.updateAssetsSuccess, (uiState, { updatedAssets }) => ({
    ...uiState,
    isLoading: false,
    errorMessage: ""
  })),

  on(fromActions.chooseAsset, (uiState, { assetID }) => ({
    ...uiState,
    chosenAssetId: assetID,
    radioChecked: uiState.range.toString()
  })),

  on(fromActions.changeAssetOrder, (uiState, { moveAssetId, inPlaceOfAssetId }) => ({
    ...uiState,
    chosenAssetId: moveAssetId,
    radioChecked: uiState.range.toString()
  })),

  on(fromActions.buyAsset, (uiState, { assetID }) => ({
    ...uiState,
    chosenAssetId: assetID,
    radioChecked: uiState.range.toString()
  })),

  on(fromActions.addAsset, (uiState, { newAsset }) => ({
    ...uiState,
    chosenAssetId: newAsset.id
  })),

  on(fromActions.sellAsset, (uiState, { assetId: assetID }) => ({
    ...uiState,
    chosenAssetId: assetID,
    radioChecked: uiState.range.toString()
  })),

  on(fromActions.changeRange, (uiState, { range }) => ({
    ...uiState,
    range: range
  })),

  on(fromActions.changeRadioButton, (uiState, { value }) => ({
    ...uiState,
    radioChecked: value
  })),

  on(fromActions.toggleShowSoldCryptos, (uiState, { }) => ({
    ...uiState,
    showSoldCryptos: !uiState.showSoldCryptos
  })),

  on(fromActions.alertNotEnoughOfAsset, (uiState, { assetId }) => ({
    ...uiState,
    alertAssetId: assetId
  })),

  on(fromActions.alertNotEnoughOfAssetDone, (uiState, { }) => ({
    ...uiState,
    alertAssetId: ""
  })),

  on(fromActions.errorNotification, (uiState, { errorMessage }) => ({
    ...uiState,
    errorMessage: errorMessage
  })),

);












export const offerStateReducer = createReducer(
  INITIAL_OFFER_STATE,

  on(fromActions.loadStateSuccess, (offerState, { loadedState }) => ({
    ...loadedState.offerState
  })),

  on(fromActions.findNewOfferSuccess, (offerState, { offeredAssets }) => ({
    ...offerState,
    nextNewAssetDate: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 1)
  })),

  on(fromActions.addAsset, (offerState, { newAsset }) => ({
    ...offerState,
    lastNewAsset: newAsset
  })),

);

export const questReducer = createReducer(
  INITIAL_QUEST,

  on(fromActions.loadStateSuccess, (quest, { loadedState }) => ({
    ...loadedState.quest
  })),


  on(fromActions.startQuest, (quest, { startAssets }) => {

    const result: Quest = {
      ...quest,
      status: QUEST_STATUS.active,
      startAssets: startAssets
    };

    switch (quest.type) {
      case QUEST_TYPE.gainTotal:
        result.score = 0;
        result.target = 100;
        break;
    }

    switch (quest.duration) {
      case QUEST_DURATION.tenMin:
        result.endTime = new Date(new Date().getTime() + 10 * 60 * 1000);
        break;
      case QUEST_DURATION.hour:
        result.endTime = new Date(new Date().getTime() + 60 * 60 * 1000);
        break;
      case QUEST_DURATION.day:
        result.endTime = new Date(new Date().getTime() + 24 * 60 * 60 * 1000);
        break;
    }

    return result;
  }),

  on(fromActions.updateQuest, (quest, { assets }) => {

    const result: Quest = { ...quest };

    if (quest.status === QUEST_STATUS.active) {
      result.score = calculateQuestScore(quest, assets);
      result.target = calculateQuestTarget(quest, assets);
      if (quest.endTime < new Date()) {
        result.status = (result.score > result.target) ? QUEST_STATUS.won : QUEST_STATUS.lost;
      }
    }

    return result;
  }),

  on(fromActions.newQuest, (quest, { lastQuest }) => {

    //Zufälligen Quest Type wählen, der ungleich dem letzten ist
    const values = Object.values(QUEST_TYPE).filter(k => k !== lastQuest.type);
    const newType = values[values.length * Math.random() << 0];


    switch (newType) {
      case QUEST_TYPE.gainTotal:
        return new Quest(newType, QUEST_DURATION.tenMin, QUEST_STATUS.prestart, new Date(0), [], 0, 0);
      case QUEST_TYPE.beatBitcoin:
        return new Quest(newType, QUEST_DURATION.tenMin, QUEST_STATUS.prestart, new Date(0), [], 0, 0);
      case QUEST_TYPE.beatAverage:
          return new Quest(newType, QUEST_DURATION.hour, QUEST_STATUS.prestart, new Date(0), [], 0, 0);
      case QUEST_TYPE.beatHodler:
          return new Quest(newType, QUEST_DURATION.day, QUEST_STATUS.prestart, new Date(0), [], 0, 0);
    }



  }),
);
