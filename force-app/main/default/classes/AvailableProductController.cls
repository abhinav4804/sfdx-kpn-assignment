public with sharing class AvailableProductController {
    
    /*
    Method name:- orderProducts
    Parameters:- 
    Description:- 
    */
    @AuraEnabled
    public static List<AvailableProductList> orderProducts(String orderId){
        List<AvailableProductList> availableProductList = new List<AvailableProductList>();

        try {
            //Get the list of already added Products based on the Order
            List<Id> prodIdList = new List<Id>();
            String priceBookId = '';
            for(OrderItem ordItm : [Select Id, Product2Id, Product2.Name, ListPrice, Order.Pricebook2Id, Quantity FROM OrderItem WHERE OrderId =: orderId]){
                prodIdList.add(ordItm.Product2Id);
                if(String.isBlank(priceBookId)){
                    priceBookId = ordItm.Order.Pricebook2Id; 
                }
                
                availableProductList.add(new AvailableProductList(ordItm));
            }

            if(String.isBlank(priceBookId)){
                priceBookId = [Select Pricebook2Id FROM Order WHERE ID =: orderId ].Pricebook2Id; 
                List<Order> orderPriceBook = [Select Pricebook2Id FROM Order WHERE ID =: orderId ];
                if(!orderPriceBook.IsEmpty()){
                    priceBookId = orderPriceBook[0].Pricebook2Id; 
                }else{
                    List<Pricebook2> priceBookInfo = [select id, name from Pricebook2 where isStandard = true limit 1];
                    if(!priceBookInfo.IsEmpty()){
                        priceBookId = priceBookInfo[0].Id;
                    }
                }
            }
            
            for(PricebookEntry pbEntry : [Select Id, Product2Id, Product2.Name, UnitPrice FROM PricebookEntry WHERE Pricebook2Id =: priceBookId AND (Product2Id NOT IN: prodIdList)]){
                availableProductList.add(new AvailableProductList(pbEntry));
            }
             
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
        return availableProductList;
    }

    @AuraEnabled
    public static void addProductToOrder(String orderId, String priceBookId, String productInfo){
        try {
            AvailableProductList selectedProdInfo = (AvailableProductList)System.JSON.deserialize(productInfo, AvailableProductList.class);
            system.debug('****productId:- ' + selectedProdInfo.productId);
            system.debug('****productName:- ' + selectedProdInfo.productName);
            system.debug('****orderItemId:- ' + selectedProdInfo.orderItemId);

            if(selectedProdInfo.addedToOrder){
                OrderItem orderItemToUpdate = new OrderItem();
                orderItemToUpdate.Id = selectedProdInfo.orderItemId;
                orderItemToUpdate.Quantity = selectedProdInfo.quantity + 1;

                update orderItemToUpdate;
            }else{

                List<PricebookEntry> priceBookEntryInfo = [Select Id, Product2Id, Product2.Name 
                                                            FROM PricebookEntry 
                                                            WHERE Pricebook2Id =: priceBookId 
                                                            AND Product2Id =: selectedProdInfo.productId];

                if(!priceBookEntryInfo.isEmpty()){

                    OrderItem orderItemToInsert = new OrderItem();
                    orderItemToInsert.OrderId = orderId;
                    orderItemToInsert.PricebookEntryId = priceBookEntryInfo[0].Id;
                    orderItemToInsert.Product2Id = selectedProdInfo.productId;
                    orderItemToInsert.Quantity = 1;
                    orderItemToInsert.UnitPrice = selectedProdInfo.listPrice;

                    insert orderItemToInsert;

                }                                            

                
            }

            //List<OrderItem> addedProductList = [Select Id, Product2Id, Quantity, TotalPrice FROM OrderItem WHERE OrderId =: orderId AND Product2Id =: productId];
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    public class AvailableProductList{

        @AuraEnabled public Id productId;
        @AuraEnabled public String productName;
        @AuraEnabled public Decimal listPrice;
        @AuraEnabled public Boolean addedToOrder;
        @AuraEnabled public Id orderItemId;
        @AuraEnabled public Decimal quantity;

        public AvailableProductList(OrderItem ordItm){
          this.productId = ordItm.Product2Id;
          this.productName = ordItm.Product2.Name;
          this.listPrice = ordItm.ListPrice;
          this.addedToOrder = true;
          this.orderItemId = ordItm.Id;
          this.quantity = ordItm.Quantity;
        }

        public AvailableProductList(PricebookEntry pbEntry){
            this.productId = pbEntry.Product2Id;
            this.productName = pbEntry.Product2.Name;
            this.listPrice = pbEntry.UnitPrice;
            this.addedToOrder = false;
        }
    }
    
    
}