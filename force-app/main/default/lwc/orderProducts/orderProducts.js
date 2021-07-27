import { LightningElement, api, track, wire } from 'lwc';
import { getRecord } from "lightning/uiRecordApi";
import { reduceErrors } from 'c/ldsUtils';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

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
    @track showSpinner = false;

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
            this.showToastMessage('Error', 'error', reduceErrors(error), 'dismissable');
        }
    }

    connectedCallback() {
        this.loadOrderProducts();
        this.subscribeToMessageChannel();
    }

    loadOrderProducts() {
        this.showSpinner = true;
        ORDERPRODUCTS({ orderId: this.recordId })
            .then(data => {

                data.forEach(ordRec => {
                    if (ordRec.Product2Id) {
                        ordRec.ProductName = ordRec.Product2.Name;
                    }
                })
                this.orderProductList = data;
                this.showSpinner = false;
            })
            .catch(error => {
                this.showSpinner = false;
                this.showToastMessage('Error', 'error', reduceErrors(error), 'dismissable');
            })
    }

    activateHandler() {

        ACTIVATEORDER({ orderId: this.recordId })
            .then(data => {

                this.activatedOrder = true;
                this.showSpinner = false;
                //Publish the event to update the Order Products status 
                const payload = { recordId: this.recordId };
                publish(this.messageContext, ORDER_CHANNEL, payload);
             })
            .catch(error => {
                this.showSpinner = false;
                this.showToastMessage('Error', 'error', reduceErrors(error), 'dismissable');
             })

    }

    showToastMessage(title, variant, message, mode){
        const showToastEvt = new ShowToastEvent({
            "title" : title,
            "variant" : variant,
            "message" : message[0],
            "mode" : mode
        });
        this.dispatchEvent(showToastEvt);
    }

}