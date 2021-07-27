import { LightningElement, api, track, wire } from 'lwc';
import { getRecord } from "lightning/uiRecordApi";

const FIELDS = ['Order.Status'];

import ORDERPRODUCTS from '@salesforce/apex/OrderProductController.orderProducts';
import ACTIVATEORDER from '@salesforce/apex/OrderProductController.activateOrder';

// Import message service features required for subscribing and the message channel
import { publish, subscribe, MessageContext } from 'lightning/messageService';
import ORDER_ITEM_CHANNEL from '@salesforce/messageChannel/OrderItemsChannel__c';
import ORDER_CHANNEL from '@salesforce/messageChannel/OrderChannel__c';

const COLUMNS = [{
    label: 'Product Name',
    fieldName: 'ProductName',
    type: 'text',
    sortable: true
},
{
    label: 'Unit Price',
    fieldName: 'UnitPrice',
    type: 'currency',
    typeAttributes: { currencyCode: 'USD' },
    sortable: true
},
{
    label: 'Quantity',
    fieldName: 'Quantity',
    type: 'number',
    sortable: true
},
{
    label: 'Total Price',
    fieldName: 'TotalPrice',
    type: 'currency',
    typeAttributes: { currencyCode: 'USD' },
    sortable: true
}
];

export default class OrderProducts extends LightningElement {

    subscription = null;
    rowOffset = 0;

    @api recordId;

    @track orderProductList;
    @track columns = COLUMNS;
    @track activatedOrder = false;

    // By using the MessageContext @wire adapter, unsubscribe will be called
    // implicitly during the component descruction lifecycle.
    @wire(MessageContext)
    messageContext;

    // Encapsulate logic for LMS subscribe.
    subscribeToMessageChannel() {
        this.subscription = subscribe(
            this.messageContext,
            ORDER_ITEM_CHANNEL,
            (message) => this.handleMessage(message)
        );
    }

    // Handler for message received by component
    handleMessage(message) {
        this.loadOrderProducts();
    }

    @wire(getRecord, { recordId: "$recordId", fields: FIELDS })
    orderRecordInfo({ error, data }) {
        if (data) {
            this.orderStatus = data.fields.Status.value;
            if (data.fields.Status.value == 'Activated') {
                this.activatedOrder = true;
            }
        } else if (error) {

        }
    }

    connectedCallback() {
        this.loadOrderProducts();
        this.subscribeToMessageChannel();
    }

    loadOrderProducts() {
        ORDERPRODUCTS({ orderId: this.recordId })
            .then(data => {

                data.forEach(ordRec => {
                    if (ordRec.Product2Id) {
                        ordRec.ProductName = ordRec.Product2.Name;
                    }
                })
                this.orderProductList = data;
            })
            .catch(error => {

            })
    }

    activateHandler() {

        ACTIVATEORDER({ orderId: this.recordId })
            .then(data => {

                this.activatedOrder = true;

                console.log('**publish');
                //Publish the event to update the Order Products status 
                const payload = { recordId: this.recordId };
                publish(this.messageContext, ORDER_CHANNEL, payload);
             })
            .catch(error => { })

    }

}