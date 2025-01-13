import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  try {
    const { shop, topic, payload } = await authenticate.webhook(request);

    // Immediately acknowledge the webhook
    setTimeout(async () => {
      // Asynchronous processing
      await processWebhook(shop, topic, payload);
    }, 1000);

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
  async function processWebhook(shop, topic, payload) {
    console.log(`Received ${topic} webhook for ${shop}`);

    console.log("Paylod recieved for order:  ", payload?.order_number);

    // Webhook requests can trigger multiple times and after an app has already been uninstalled.
    // If this webhook already ran, the session may have been deleted previously.

    const revenueGoalId = "100478811";

    // Event subscriptions
    const convertAttributesStr = payload.note_attributes.find(
      (attr) => attr.name === "_conv_attrs",
    )?.value;

    if (convertAttributesStr) {
      console.log("Convert attributes string retrieved:", convertAttributesStr);
      await postTransaction(convertAttributesStr, payload);
    } else {
      console.log("Convert Attributes retrieval failed.");
    }

    // Function to post transaction details
    async function postTransaction(convertAttributesStr, orderData) {
      const convertAttributes = JSON.parse(convertAttributesStr);
      const conversionRate = parseFloat(convertAttributes.conversionRate) || 1; // Default to 1 if not provided
      console.log(
        "Conversion attributes parsed successfully:",
        convertAttributes,
      );
      let totalRevenue = orderData.total_price;
      let totalProducts = 0;

      // Iterate over each product in the checkout event
      orderData.line_items.forEach((product) => {
        console.log("Processing product:", product?.id);
        console.log("Line Item variant id" + product?.variant_id);
        totalProducts += product.quantity;
      });

      console.log(
        "Total products:",
        totalProducts,
        "Total revenue:",
        totalRevenue,
      );

      // Build POST data for subscription products
      if (totalProducts > 0) {
        await postConversion(convertAttributes, revenueGoalId);
        await sendTrackingBeacon(
          convertAttributes,
          totalRevenue,
          totalProducts,
          revenueGoalId,
        );
      }
    }

    //function to post conversion
    async function postConversion(convertAttributes, goalId) {
      console.log("Triggering Conversion with goal id:", goalId);
      const post = {
        cid: convertAttributes.cid,
        pid: convertAttributes.pid,
        seg: convertAttributes.defaultSegments,
        s: "shopify",
        vid: convertAttributes.vid,
        ev: [
          {
            evt: "hitGoal",
            goals: [goalId],
            exps: convertAttributes.exps,
            vars: convertAttributes.vars,
          },
        ],
      };
      const data = JSON.stringify(post);
      console.log("Data for Conversion:", data);
      try {
        const res = await fetch(
          `https://${convertAttributes.pid}.metrics.convertexperiments.com/track`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json", // Ensure the content type is correct
            },
            body: data,
          },
        );
        console.log("Conversion Data Successfully Sent", {
          status: res?.ok,
          message: res?.statusText,
          orderNumber: payload?.order_number,
        });
      } catch (error) {
        console.log("Error Sending Conversion Data", {
          error,
          orderNumber: payload?.order_number,
        });
      }
    }

    // Function to send tracking data using Beacon API
    async function sendTrackingBeacon(
      attributes,
      revenue,
      productCount,
      goalId,
    ) {
      const post = {
        cid: attributes.cid,
        pid: attributes.pid,
        seg: attributes.defaultSegments,
        s: "shopify",
        vid: attributes.vid,
        ev: [
          {
            evt: "tr",
            exps: attributes.exps,
            vars: attributes.vars,
            r: revenue, // Revenue already adjusted in the postTransaction function
            prc: productCount,
            goals: [goalId],
          },
        ],
      };
      const data = JSON.stringify(post);
      console.log("Data to for Transaction:", data);
      try {
        const res = await fetch(
          `https://${attributes.pid}.metrics.convertexperiments.com/track`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json", // Ensure the content type is correct
            },
            body: data,
          },
        );
        console.log("Transactional Data Successfully Sent", {
          status: res?.ok,
          message: res?.statusText,
          orderNumber: payload?.order_number,
        });
      } catch (error) {
        console.log("Error Sending Transactional Data", {
          error,
          orderNumber: payload?.order_number,
        });
      }
    }
  }
};
