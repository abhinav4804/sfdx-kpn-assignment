import { LightningElement, api, track, wire } from 'lwc';
import { getRecord } from "lightning/uiRecordApi";
import { reduceErrors } from 'c/ldsUtils';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

const FIELDS = ['Order.Pricebook2Id', 'Order.Status'];

import ORDERPRODUCTS from '@salesforce/apex/AvailableProductController.orderProducts';
import ADDPRODUCTS from '@salesforce/apex/AvailableProductController.addProductToOrder';

// Import message service features required for publishing and the message channel
import { publish, subscribe, MessageContext } from 'lightning/messageService';
import ORDER_ITEM_CHANNEL from '@salesforce/messageChannel/OrderItemsChannel__c';
import ORDER_CHANNEL from '@salesforce/messageChannel/OrderChannel__c';

const COLUMNS = [{
    label: 'Name',
    fieldName: 'productName',
    type: 'text',
    sortable: true
},
{
    label: 'List Price',
    fieldName: 'listPrice',
    type: 'currency',
    typeAttributes: { currencyCode: 'USD' },
    sortable: true
},
{
    type: "button", typeAttributes: {
        label: 'Add',
        name: 'Add',
        title: 'Add',
        disabled: false,
        value: 'Add',
        iconPosition: 'left',
        variant: 'brand'
    }
}
];

export default class AvailableProducts extends LightningElement {

    priceBookId;

    @api recordId;

    @track availableProdList;
    @track columns = COLUMNS;
    @track activatedOrder = false;
    @track showSpinner = false;

    rowOffset = 0;

    @wire(MessageContext)
    messageContext;

    @wire(getRecord, { recordId: "$recordId", fields: FIELDS })
    orderRecordInfo({ error, data }) {
        if (data) {
            this.priceBookId = data.fields.Pricebook2Id.value;
            if (data.fields.Status.value == 'Activated') {
                this.activatedOrder = true;

                this.columns.forEach(item => {
                    if (item.type == 'button') {
                        item.typeAttributes.disabled = true;
                    }
                })

            }
        } else if (error) {
            this.showToastMessage('Error', 'error', reduceErrors(error), 'dismissable');
        }
    }

    connectedCallback() {
        this.loadOrderProducts(false);
        this.subscribeToMessageChannel();
    }

    // Encapsulate logic for LMS subscribe.
    subscribeToMessageChannel() {
        this.subscription = subscribe(
            this.messageContext,
            ORDER_CHANNEL,
            (message) => this.handleMessage(message)
        );
    }

    // Handler for message received by component
    handleMessage(message) {
        this.loadOrderProducts(true);
    }

    loadOrderProducts(fromMessageService) {
        this.showSpinner = true;
        if (fromMessageService) {
            this.columns.forEach(item => {
                if (item.type == 'button') {
                    item.typeAttributes.disabled = true;
                }
            })
        }
        ORDERPRODUCTS({ orderId: this.recordId })
            .then(data => {
                this.availableProdList = data;
                this.showSpinner = false;
            })
            .catch(error => {
                this.showSpinner = false;
                this.showToastMessage('Error', 'error', reduceErrors(error), 'dismissable');
            })
    }

    addProductHandler(event) {
        this.showSpinner = true;
        let productInfo;
        const recId = event.detail.row.productId;
        //const actionName = event.detail.action.name; 

        this.availableProdList.some((row, index) => {
            if (row.productId === recId) {
                productInfo = row;
                return true;
            }
        });

        ADDPRODUCTS({ orderId: this.recordId, priceBookId: this.priceBookId, productInfo: JSON.stringify(productInfo) })
            .then(data => {
                this.loadOrderProducts();
                this.showSpinner = false;
                //Publish the event to update the Order Products status 
                const payload = { recordId: this.recordId };
                publish(this.messageContext, ORDER_ITEM_CHANNEL, payload);

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