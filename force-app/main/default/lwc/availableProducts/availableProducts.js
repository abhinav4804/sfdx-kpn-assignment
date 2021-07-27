import { LightningElement, api, track, wire } from 'lwc';
import { getRecord } from "lightning/uiRecordApi";

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

        }
    }

    connectedCallback() {
        this.loadOrderProducts();
        this.subscribeToMessageChannel(false);
    }

    // Encapsulate logic for LMS subscribe.
    subscribeToMessageChannel() {console.log('**subscribe');
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
        console.log('Method called');
        if (fromMessageService) {
            this.columns.forEach(item => {
                if (item.type == 'button') {
                    console.log('**set to true');
                    item.typeAttributes.disabled = true;
                }
            })
        }
        ORDERPRODUCTS({ orderId: this.recordId })
            .then(data => {
                this.availableProdList = data;
            })
            .catch(error => {

            })
    }

    addProductHandler(event) {
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
                
                //Publish the event to update the Order Products status 
                const payload = { recordId: this.recordId };
                publish(this.messageContext, ORDER_ITEM_CHANNEL, payload);

            })
            .catch(error => { })

    }


}