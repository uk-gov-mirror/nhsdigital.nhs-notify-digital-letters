export type SingleMessageRequest = {
  data: {
    type: string;
    attributes: {
      routingPlanId: string;
      messageReference: string;
      billingReference: string;
      recipient: {
        nhsNumber: string;
      };
      originator: {
        odsCode: string;
      };
      personalisation: {
        digitalLetterURL: string;
      };
    };
  };
};

export type SingleMessageResponse = {
  data: {
    type: string;
    id: string;
    attributes: {
      messageReference: string;
      messageStatus: string;
      timestamps: {
        created: string;
      };
      routingPlan: {
        id: string;
        version: string;
        createdDate: string;
        name: string;
      };
    };
    links: {
      self: string;
    };
  };
};

export type SingleMessageErrorResponse = {
  errors: [
    {
      id: string;
      code: string;
      detail: string;
    },
  ];
};
